import { ComponentSettingsStorage } from "../components/storage";


const _chromeItemKey = "componentSettings";
export async function createChromeComponentSettingsStorage(): Promise<ComponentSettingsStorage> {
	const result = await chrome.storage.sync.get(_chromeItemKey);
	const storage = result[_chromeItemKey] ?? {};
	return new ChromeComponentSettingsStorage(storage);
}

class ChromeComponentSettingsStorage implements ComponentSettingsStorage {
	constructor(readonly storage: Record<string, unknown>) {
	}

	get<T>(key: string): T | undefined {
		return this.storage[key] as T | undefined;
	}

	set(key: string, value: unknown): void {
		this.storage[key] = value;
		chrome.storage.sync.set({ [_chromeItemKey]: this.storage });
	}
}