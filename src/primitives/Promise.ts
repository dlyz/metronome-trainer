
export type CachedPromise<T> = ReturnType<typeof cachePromiseResult<T>>;

export function cachePromiseResult<T>(promise: Promise<T>) {
	let r: T;
	let hasR = false;
	promise.then(res => {
		r = res;
		hasR = true;
	});

	return {
		promise,
		get hasResult() { return hasR; },
		get result() {
			if (!hasR) {
				throw new Error("cached promise has no result yet");
			}

			return r;
		},
	}
}

export function createDeferredPromise<T = void>() {
	let resolve: (value: T | PromiseLike<T>) => void;
	let reject: (reason?: any) => void;
	const promise = new Promise<T>((_resolve, _reject) => [resolve, reject] = [_resolve, _reject]);
	return {
		promise,
		resolve: resolve!,
		reject: reject!,
	}
}
