
import { sleep } from "./util";

type ClientMessage = {
    type: "call",
    id: number,
    method: string,
    args: any[]
};
type ServerMessage = {
    type: "callback",
    id: number,
    data: any
} | {
        type: "AsyncIteratorElement",
        id: number,
        value: IteratorResult<any>
    } | {
        type: "AsyncIteratorRejection",
        id: number,
        value: any
    };
type SpecialValue = {
    $$type: "AsyncIterator",
    id: number
};
function isSpecialValue(x: any): x is SpecialValue {
    return !!x.$$type;
}
const port = 1234;

export async function makeServer(server: any) {
    const WebSocket = await import("ws");
    const wss = new WebSocket.Server({ port });
    wss.on('connection', (client, request) => {
        function send(data: ServerMessage) {
            client.send(JSON.stringify(data, replacer));
        }
        function replacer(key: string, value: any) {
            if (value && value[Symbol.asyncIterator]) {
                console.log("got async iterator at", key);
                const iteratorId = remotifyAsyncIterator(value, send);
                return {
                    $$type: "AsyncIterator" as "AsyncIterator",
                    id: iteratorId
                } as SpecialValue;
            } else {
                return value;
            }
        }
        client.on('message', async (data) => {
            const message = JSON.parse(data as string) as ClientMessage;
            switch (message.type) {
                case "call": {
                    const { method, args, id } = message;
                    console.log("calling", method, args);
                    if (server[method]) {
                        let result = server[method](...args);
                        if (typeof result.then === 'function') {
                            console.log("got promise");
                            result = await result;
                        }
                        send({
                            type: "callback",
                            id,
                            data: result
                        });
                    }
                    break;
                }
            }
        });
    });
    console.log("listening on port", port);
}

let asyncIteratorCounter = 1;
function remotifyAsyncIterator(iterator: AsyncIterable<any>, send: (x: ServerMessage) => void) {
    const id = asyncIteratorCounter++;
    (async () => {
        try {
            for await (const element of iterator) {
                send({
                    type: "AsyncIteratorElement",
                    id,
                    value: { value: element, done: false }
                });
            }
            send({
                type: "AsyncIteratorElement",
                id,
                value: { done: true, value: undefined }
            });
        } catch (e) {
            send({
                type: "AsyncIteratorRejection",
                id,
                value: e
            });
        }
    })();
    return id;
}

export async function makeClient<T>(): Promise<T> {
    const client = new WebSocket(`ws://localhost:${port}`);
    const openCallbacks = new Map<number, (result: any) => void>();
    const openIterators = new Map<number, { resolve: (element: IteratorResult<any>) => void, reject: (error: any) => void }>();
    await new Promise(resolve => client.addEventListener('open', resolve, { once: true } as any));
    async function* iterateRemotely(id: number) {
        while (true) {
            let res;
            try {
                res = await new Promise<IteratorResult<any>>((resolve, reject) => openIterators.set(id, { resolve, reject }));
            } catch (e) {
                openIterators.delete(id);
                throw e;
            }
            if (res.done) {
                openIterators.delete(id);
                return;
            } else yield res.value;
        }
    }
    function reviver(key: string, value: any) {
        if (isSpecialValue(value)) {
            switch (value.$$type) {
                case "AsyncIterator": {
                    return iterateRemotely(value.id);
                }
                default: {
                    throw `Unknown special value: ${value.$$type}}`;
                }
            }
        } else {
            return value;
        }
    }
    client.addEventListener("message", async ev => {
        const message = JSON.parse(ev.data as string, reviver) as ServerMessage;
        switch (message.type) {
            case 'callback': {
                openCallbacks.get(message.id)!(message.data);
                break;
            }
            case 'AsyncIteratorElement': {
                openIterators.get(message.id)!.resolve(message.value);
                break;
            }
            case 'AsyncIteratorRejection': {
                openIterators.get(message.id)!.reject(message.value);
                break;
            }
            default: {
                throw `unknown message ${message.type}`;
            }
        }
    });
    let callbackCounter = 1;
    function send(message: ClientMessage) {
        client.send(JSON.stringify(message));
    }
    function remoteCall(method: string, args: any[]) {
        console.log("calling", method, args);
        const id = callbackCounter++;
        return new Promise(resolve => {
            openCallbacks.set(id, resolve);
            send({
                type: 'call',
                method,
                id,
                args
            });
        });
    }
    return new Proxy({}, {
        get: (_, attrname) => {
            if (typeof attrname !== 'string') throw Error(`${attrname} is not a valid function name`);
            if (attrname === 'then') return undefined;
            return (...args: any[]) => remoteCall(attrname, args);
        }
    }) as T;
}