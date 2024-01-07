import { throttle } from "lodash";
import { ComponentSettingsStorage } from "../components/storage";


const _chromeItemKey = "componentSettings";
export async function createChromeComponentSettingsStorage(): Promise<ComponentSettingsStorage> {
	const result = await chrome.storage.local.get(_chromeItemKey);
	const storage = result[_chromeItemKey] ?? {};
	//console.log(_chromeItemKey, storage);
	return new ChromeComponentSettingsStorage(storage);
}

class ChromeComponentSettingsStorage implements ComponentSettingsStorage {
	constructor(readonly storage: Record<string, unknown>) {
	}

	get<T>(key: string): T | undefined {
		return this.storage[key] as T | undefined;
	}

	#write = throttle(
		() => {
			chrome.storage.local.set({ [_chromeItemKey]: this.storage });
		},
		1000,
		{
			leading: false,
			trailing: true,
		}
	);

	set(key: string, value: unknown): void {
		this.storage[key] = value;
		this.#write();
	}
}