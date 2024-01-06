
export interface BasicEvent<T extends unknown[] = []> {
	add(handler: (...event: T) => void): void;
	remove(handler: (...event: T) => void): void;
	subscribe(handler: (...event: T) => void): () => void;
}


export interface ObservableValue<T> extends BasicEvent {
	readonly value: T;
}

export class EventControl<T extends unknown[] = []> implements BasicEvent<T> {

	#invoking?: Array<(...event: T) => void>;
	#handlers: Array<(...event: T) => void> = [];

	get handlersCount() { return this.#handlers.length; }

	add(handler: (...event: T) => void) {
		if (this.#invoking === this.#handlers) {
			this.#handlers = [...this.#handlers];
		}

		this.#handlers.push(handler);
	}

	remove(handler: (...event: T) => void) {
		const index = this.#handlers.lastIndexOf(handler);
		if (index !== -1) {

			if (this.#invoking === this.#handlers) {
				this.#handlers = [...this.#handlers];
			}

			this.#handlers.splice(index, 1);
		}
	}

	subscribe(handler: (...event: T) => void) {
		this.add(handler);
		return () => this.remove(handler);
	}

	invoke(...event: T) {
		const handlers = this.#invoking = this.#handlers;
		try {

			for (const handler of handlers) {
				handler(...event);
			}

		} finally {
			this.#invoking = undefined;
		}
	}

}

export class ObservableValueControl<T> implements ObservableValue<T> {
	constructor(value: T) {
		this.#value = value;
	}

	#value: T;
	#event = new EventControl();

	get value() { return this.#value; }

	setValue(value: T) {
		if (this.#value === value) return;
		this.#value = value;
		this.#event.invoke();
	}

	add(handler: () => void) { return this.#event.add(handler); }
	remove(handler: () => void) { return this.#event.remove(handler); }
	subscribe(handler: () => void) { return this.#event.subscribe(handler); }
}


export class ObservableValueProxy<T> implements ObservableValue<T> {
	constructor(
		private readonly getValue: () => T,
		subscribe: (handler: () => void) => () => void,
	) {
		this.#doSubscribe = subscribe;
	}

	get value() { return this.getValue(); }

	#doSubscribe;
	#subscription?: () => void;
	readonly #event = new EventControl();

	add(handler: () => void) {
		if (!this.#subscription) {
			this.#subscription = this.#doSubscribe(() => this.#event.invoke());
		}

		this.#event.add(handler);
	}

	remove(handler: () => void) {
		this.#event.remove(handler);

		if (this.#event.handlersCount === 0) {
			const sub = this.#subscription;
			this.#subscription = undefined;
			sub?.();
		}
	}

	subscribe(handler: () => void) {
		this.add(handler);
		return () => this.remove(handler);
	}

}
