
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
