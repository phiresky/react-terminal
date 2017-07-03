export function sleep(duration_ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration_ms));
}


export function polyfillAsyncIterator() {
    if (!Symbol.asyncIterator) {
        Object.assign(Symbol, { asyncIterator: Symbol("asyncIterator") });
    }
}