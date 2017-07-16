import { Readable } from 'stream';

export async function* streamToIterable(readable: Readable) {
    const endPromise = new Promise<IteratorResult<string | Buffer>>(resolve => readable.once("end", () => resolve({ value: undefined!, done: true })));
    while (true) {
        const data = await Promise.race([
            new Promise<IteratorResult<string | Buffer>>(resolve => readable.once("data", chunk => resolve({ value: chunk, done: false }))),
            endPromise
        ]);
        if (data.done) return;
        if (data.value instanceof Buffer) yield data.value.toString("utf8");
        else yield data.value;
    };
}