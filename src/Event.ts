
export interface BasicEvent<T extends unknown[] = []> {
  add(handler: (...event: T) => void): void;
  remove(handler: (...event: T) => void): void;
}

type q = (a: number, b: string) => object;



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
