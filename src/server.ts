import * as fs from 'mz/fs';
import * as util from './util';
import * as path from 'path';
import { spawn } from 'child_process';
import * as stream from "stream";
import * as types from "./types";
import { streamToIterable } from "./serverUtil";
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
    for await (const [stdout, stderr] of util.merge(streamToIterable(process.stdout), streamToIterable(process.stderr))) {
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