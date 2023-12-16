import { useMemo, useState } from "react";

export interface ComponentSettingsStorage {

	get<T>(key: string): T | undefined;
	set(key: string, value: unknown): void;

}

export function useStorageValue<T>(storage: ComponentSettingsStorage, key: string, defaultValue: T | undefined = undefined) {

	const [value, setStateValue] = useState(() => {
		const v = storage.get<T>(key);
		return v === undefined ? defaultValue : v;
	});
	const setValue = (value: T) => { storage.set(key, value); setStateValue(value); }
	return [value, setValue] as const;
}
