export function sleep(duration_ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration_ms));
}


export function polyfillAsyncIterator() {
    if (!Symbol.asyncIterator) {
        Object.assign(Symbol, { asyncIterator: Symbol("asyncIterator") });
    }
}

export function humanFileSize(bytes: number, si: boolean) {
    var thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
}

export async function* makeAsync<T>(inp: Promise<T[]>): AsyncIterableIterator<T> {
    yield* await inp;
}

const neverResolve = new Promise<never>(() => { });
export async function* merge<T1, T2>(it1: AsyncIterableIterator<T1>, it2: AsyncIterableIterator<T2>): AsyncIterableIterator<[T1, null] | [null, T2]> {
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

export function tuple<A, B>(a: A, b: B) {
    return [a, b] as [A, B];
}