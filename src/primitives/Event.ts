
export interface BasicEvent<T extends unknown[] = []> {
	add(handler: (...event: T) => void): void;
	remove(handler: (...event: T) => void): void;
}


export interface ObservableValue<T> extends BasicEvent {
	readonly value: T;
}

export class EventControl<T extends unknown[] = []> implements BasicEvent<T> {

	#invoking?: Array<(...event: T) => void>;
	#handlers: Array<(...event: T) => void> = [];

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
}