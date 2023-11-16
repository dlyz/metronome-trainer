import { EventControl } from "./Event";


interface SessionStorageProvider<T> {
	readonly current: T;
	addListener(handler: () => void): void;
	removeListener(handler: () => void): void;
}

export async function readSessionStorage<T>(): Promise<SessionStorageProvider<T>> {
	const event = new EventControl();

	let currentValue: any;


	chrome.storage.session.onChanged.addListener((changes) => {
		if (!currentValue) {
			currentValue = {};
		}

		Object.assign(currentValue, Object.fromEntries(Object.entries(changes).map(e => [e[0], e[1].newValue ?? null])));
		event.invoke();
	});

	const gotValue = await chrome.storage.session.get();
	if (currentValue) {
		currentValue = { ...gotValue, ...currentValue };
	} else {
		currentValue = gotValue;
	}

	return {
		addListener(handler) { event.add(handler); },
		removeListener(handler) { event.remove(handler); },
		get current() { return currentValue as T; },
	}
}

