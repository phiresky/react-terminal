//import * as fs from 'mz/fs';
import * as util from './util';
if (!Symbol.asyncIterator) {
    Object.assign(Symbol, { asyncIterator: Symbol("asyncIterator") });
}

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

const fs = {
    async readdir(path: string) {
        return ["test", "ha", "hi"];
    }
}
const cwd = __dirname;

export type Command = {
    type: "string",
    cmd: string
}
export async function* executeCommand(cmd: Command): AsyncIterableIterator<CommandOutput> {
    console.log("executing", cmd);
    const cmdSplit = cmd.cmd.split(" ");
    switch (cmdSplit[0]) {
        case 'ls': {
            const res = await fs.readdir(cwd);
            yield * res.map(fname => ({
                type: "SingleOutput",
                meta: "filename",
                data: fname
            } as SingleOutput));
            await util.sleep(1000);
            yield {
                type: "SingleOutput",
                meta: "filename",
                data: "later"
            };
            return;
        }
        case 'echo': {
            yield {
                type: "SingleOutput",
                meta: "echo",
                data: cmdSplit.slice(1).join(" ")
            };
            return;
        }
        default: {
            yield {
                type: "SingleOutput",
                meta: "error",
                data: "Unknown command: " + cmd.cmd
            };
            return;
        }
    }
}

async function* makeAsync<T>(inp: Promise<T[]>): AsyncIterableIterator<T> {
    yield* await inp;
}