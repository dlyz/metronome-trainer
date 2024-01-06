import { createDeferredPromise } from "./Promise";



interface ScheduledAction<TKind> {
	kind: TKind,
	action: () => Promise<void>,
	result: {
		promise: Promise<void>,
		resolve: () => void,
		reject: (error: unknown) => void,
	}
}

export class AsyncActionGate<TKind = string> {

	#pendingActions: Array<ScheduledAction<TKind>> = [];
	#currentAction?: ScheduledAction<TKind>;

	add(kind: TKind, action: () => Promise<void>): Promise<void> {

		let pending = this.#pendingActions.find(a => a.kind === kind);
		if (pending) {
			pending.action = action;
			return pending.result.promise;
		}

		const result = createDeferredPromise();

		pending = {
			kind,
			action,
			result,
		};

		this.#pendingActions.push(pending);

		if (!this.#currentAction) {
			this.#scheduleNext();
		}

		return result.promise;
	}

	getLastPromise(kind?: TKind) {
		if (kind === undefined) {
			return (this.#pendingActions.at(-1) ?? this.#currentAction)?.result.promise;
		} else {
			return this.#findLastAction(a => a.kind === kind)?.result.promise;
		}
	}

	findLastPromise(predicate: (kind: TKind) => boolean) {
		return this.#findLastAction(a => predicate(a.kind))?.result.promise;
	}

	#findLastAction(predicate: (action: ScheduledAction<TKind>) => boolean) {
		const action = this.#pendingActions.find(predicate);
		if (action) return action;

		const currentAction = this.#currentAction;
		if (currentAction && predicate(currentAction)) {
			return currentAction;
		}

		return undefined;
	}

	#scheduleNext = () => {
		const action = this.#currentAction = this.#pendingActions.shift();
		if (!action) {
			return;
		}

		let promise;
		try {
			promise = action.action();
		} catch (ex) {
			promise = Promise.reject(ex);
		}

		promise
			.then(
				action.result.resolve,
				action.result.reject,
			)
			.finally(this.#scheduleNext)
		;

	}
}
