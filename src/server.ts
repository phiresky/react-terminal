import * as fs from 'mz/fs';
import * as util from './util';
import * as path from 'path';
import { spawn } from 'child_process';
import * as stream from "stream";

util.polyfillAsyncIterator();

export type CommandOutput = StreamingOutput | SingleOutput;

export type StreamingOutput = {
    type: "StreamingOutput",
    data: CommandOutput[],
    done: boolean
};
export type SingleOutput = {
    type: "SingleOutput",
    meta: string,
    data: any
};

export type Command = {
    type: "string",
    cmd: string
}
let cwd = __dirname;

async function* _executeCommand(cmd: Command): AsyncIterableIterator<CommandOutput> {
    console.log("executing", cmd);
    const cmds = cmd.cmd.split(";");
    if (cmds.length > 1) {
        for (const cmd of cmds) {
            yield* _executeCommand({ type: "string", cmd });
        }
        return;
    }
    const cmdSplit = cmd.cmd.trim().split(" ");
    switch (cmdSplit[0]) {
        /*case 'ls': {
            const res = await fs.readdir(cwd);
            yield* res.map(fname => ({
                type: "SingleOutput" as "SingleOutput",
                meta: "filename",
                data: fname
            }));
            return;
        }*/
        /*case 'echo': {
            yield {
                type: "SingleOutput",
                meta: "echo",
                data: cmdSplit.slice(1).join(" ")
            };
            return;
        }*/
        case 'cd': {
            if (path.isAbsolute(cmdSplit[1])) cwd = cmdSplit[1];
            else cwd = path.join(cwd, cmdSplit[1]);
            yield {
                type: "SingleOutput",
                meta: "empty",
                data: "cwd: " + cwd
            };
            return;
        }
        case 'sleep': {
            const duration = +cmdSplit[1];
            await util.sleep(duration * 1000);
            return;
        }
        default: {
            try {
                const process = spawn(cmdSplit[0], cmdSplit.slice(1), { cwd });
                process.on("error", e => console.log(e));
                for await (const str of streamToIterable(process.stdout)) {
                    yield {
                        type: "SingleOutput",
                        meta: "generic",
                        data: str
                    };
                }
            } catch (e) {
                yield {
                    type: "SingleOutput",
                    meta: "error",
                    data: e
                };
            }
            return;
        }
    }
}

async function* streamToIterable(readable: stream.Readable) {
    const endPromise = new Promise<IteratorResult<string | Buffer>>(resolve => readable.once("end", () => resolve({ value: undefined!, done: true })));
    while (true) {
        const data = await Promise.race([
            new Promise<IteratorResult<string | Buffer>>(resolve => readable.once("data", chunk => resolve({ value: chunk, done: false }))),
            endPromise
        ]);
        console.log("got", data);
        if (data.done) return;
        if (data.value instanceof Buffer) yield data.value.toString("utf8");
        else yield data.value;
    };
}
export async function executeCommand(cmd: Command): Promise<AsyncIterableIterator<CommandOutput>> {
    return _executeCommand(cmd);
}

async function* makeAsync<T>(inp: Promise<T[]>): AsyncIterableIterator<T> {
    yield* await inp;
}