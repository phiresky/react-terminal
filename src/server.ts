import * as fs from 'mz/fs';
import * as util from './util';
import * as path from 'path';
import { spawn } from 'child_process';
import * as stream from "stream";
import * as types from "./types";

util.polyfillAsyncIterator();

export type CommandOutput = {
    $innerType: string,
    data: AsyncIterableIterator<any>,
};

export type Command = {
    type: "string",
    cmd: string
}
let cwd = __dirname;


async function* ls(dirname: string): AsyncIterableIterator<types.FileStat> {
    dirname = path.resolve(cwd, dirname);
    for (const filename of await fs.readdir(dirname)) {
        const fpath = path.join(dirname, filename);
        const stat = await fs.stat(fpath);
        yield {
            dirname, filename, stat
        };
    }
}
async function* iterateOver<T>(...data: T[]): AsyncIterableIterator<T> {
    for (const ele of data) yield ele;
}
async function* nativeCommand([cmd, ...args]: string[]): AsyncIterableIterator<types.ProcessOutput> {
    const process = spawn(cmd, args, { cwd });
    let error: Error | null = null;
    process.on("error", e => error = e);
    for await (const [stdout, stderr] of merge(streamToIterable(process.stdout), streamToIterable(process.stderr))) {
        if (stdout !== null) yield {
            stream: "stdout",
            text: stdout
        }; else if (stderr !== null) yield {
            stream: "stderr",
            text: stderr
        };
    }
    if (error) throw error;
}
export async function executeCommand(cmd: Command): Promise<CommandOutput> {
    console.log("executing", cmd);
    const cmds = cmd.cmd.split(";");
    if (cmds.length > 1) {
        return {
            $innerType: "any",
            data: async function* () {
                for (const cmd of cmds) {
                    const res = await executeCommand({ type: "string", cmd });
                    yield* res.data;
                }
            }()
        }
    }
    const cmdSplit = cmd.cmd.trim().split(" ");
    switch (cmdSplit[0]) {
        case 'ls': {
            return {
                $innerType: "FileStat",
                data: ls(cmdSplit[1] || ".")
            };
        }
        case 'testloop': {
            return {
                $innerType: "string",
                data: async function* () {
                    yield 1;
                    await util.sleep(1000);
                    yield 2;
                    await util.sleep(1000);
                    yield 3;
                    await util.sleep(1000);
                    yield 4;
                }()
            }
        }
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
            return {
                $innerType: "string",
                data: iterateOver("cwd: " + cwd)
            };
        }
        case 'sleep': {
            const duration = +cmdSplit[1];
            await util.sleep(duration * 1000);
            return {
                $innerType: "undefined",
                data: iterateOver(undefined)
            };
        }
        default: {
            return {
                $innerType: "ProcessOutput",
                data: nativeCommand(cmdSplit)
            }
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

async function* makeAsync<T>(inp: Promise<T[]>): AsyncIterableIterator<T> {
    yield* await inp;
}

const neverResolve = new Promise<never>(() => { });
async function* merge<T1, T2>(it1: AsyncIterableIterator<T1>, it2: AsyncIterableIterator<T2>): AsyncIterableIterator<[T1, null] | [null, T2]> {
    let done1 = false, done2 = false;
    let next1 = it1.next(), next2 = it2.next();
    while (!done1 || !done2) {
        const [res1, res2] = await Promise.race([next1.then(res => tuple(res, null)), next2.then(res => tuple(null, res))]);
        if (res1) {
            if (res1.done) {
                done1 = true;
                next1 = neverResolve;
            } else {
                yield [res1.value, null];
                next1 = it1.next();
            }
        } else if (res2) {
            if (res2.done) {
                done2 = true;
                next2 = neverResolve;
            } else {
                yield [null, res2.value];
                next2 = it2.next();
            }
        }
    }
}

function tuple<A, B>(a: A, b: B) {
    return [a, b] as [A, B];
}