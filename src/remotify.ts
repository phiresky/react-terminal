
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
    data: {
        type: "AsyncIterator",
        id: number,
    } | {
        type: "normal",
        data: any
    }
} | {
        type: "AsyncIteratorElement",
        id: number,
        value: IteratorResult<any>
    };
const port = 1234;
export async function makeServer(server: any) {
    const WebSocket = await import("ws");
    const wss = new WebSocket.Server({ port });
    wss.on('connection', (client, request) => {
        function send(data: ServerMessage) {
            client.send(JSON.stringify(data));
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
                        let data;
                        if (result[Symbol.asyncIterator]) {
                            console.log("got async iterator");
                            const iteratorId = remotifyAsyncIterator(result, send);
                            data = {
                                type: "AsyncIterator" as "AsyncIterator",
                                id: iteratorId
                            };

                        } else {
                            data = {
                                type: "normal" as "normal",
                                data: result
                            };
                        }
                        send({
                            type: "callback",
                            id,
                            data
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
    })();
    return id;
}

export async function makeClient<T>(): Promise<T> {
    const client = new WebSocket(`ws://localhost:${port}`);
    const openCallbacks = new Map<number, (result: any) => void>();
    const openIterators = new Map<number, (element: IteratorResult<any>) => void>();
    await new Promise(resolve => client.addEventListener('open', resolve, { once: true } as any));
    async function* iterateRemotely(id: number) {
        while (true) {
            const res = await new Promise<IteratorResult<any>>(resolve => openIterators.set(id, resolve));
            if (res.done) {
                openIterators.delete(id);
                return;
            } else yield res.value;
        }
    }
    client.addEventListener("message", async ev => {
        const message = JSON.parse(ev.data as string) as ServerMessage;
        switch (message.type) {
            case 'callback': {
                let result: any;
                if (message.data.type === "AsyncIterator") {
                    result = iterateRemotely(message.data.id);
                } else if (message.data.type === "normal") {
                    result = message.data.data;
                } else throw Error("unex");
                openCallbacks.get(message.id)!(result);
                break;
            }
            case 'AsyncIteratorElement': {
                openIterators.get(message.id)!(message.value);
                break;
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