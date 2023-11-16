import { useMemo, useRef } from "react";


export function useInitializedRef<T>(factory: () => T): React.MutableRefObject<T> {

	const ref = useRef<T>();

	// it is ok: https://react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents
	if (!ref.current) {
		ref.current = factory();
	}

	return ref as React.MutableRefObject<T>;
}


export interface RefEffectHandle<TArg> {
	readonly activate: (arg: TArg) => void;
	readonly deactivate: () => void;
}

export interface RefEffect<TRefValue, TArg> extends RefEffectHandle<TArg> {
	readonly ref: React.RefCallback<TRefValue>;
}

export function createRefEffect<TRefValue, TArg = void>(effect: (refValue: TRefValue, arg: TArg) => void) : RefEffect<TRefValue, TArg> {
	return new RefEffectImpl(effect);
}


class RefEffectImpl<TRefValue, TArg> implements RefEffect<TRefValue, TArg> {

	#isActive = false;
	#activationArg: TArg | undefined;
	#effect: (refValue: TRefValue, arg: TArg) => void;
	#refValue: TRefValue | null = null;

	constructor(effect: (refValue: TRefValue, arg: TArg) => void) {
		this.#effect = effect;
	}

	readonly activate = (arg: TArg) => {
		this.#activationArg = arg;
		this.#isActive = true;
		if (this.#refValue !== null) {
			this.#effect(this.#refValue, arg);
		}
	}

	readonly deactivate = () => {
		this.#isActive = false;
		this.#activationArg = undefined;
	}

	readonly ref = (refValue: TRefValue | null) => {
		this.#refValue = refValue;

		if (refValue !== null && this.#isActive) {
			this.#effect(refValue, this.#activationArg!);
		}
	}
}
