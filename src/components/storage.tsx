import React, { useCallback, useContext, useMemo, useState } from "react";

export interface ComponentSettingsStorage {

	get<T>(key: string): T | undefined;
	set(key: string, value: unknown): void;

}

export const componentSettingsStorageContext = React.createContext<ComponentSettingsStorage>(undefined!);

export function useStorageValue<T>(key: string, defaultValue: T) : [T, (value: T) => void]
export function useStorageValue<T>(key: string, defaultValue?: undefined) : [T | undefined, (value: T) => void]
export function useStorageValue<T>(key: string, defaultValue: T | undefined = undefined) {

	const storage = useContext(componentSettingsStorageContext);

	const [value, setStateValue] = useState(() => {
		const v = storage.get<T>(key);
		return v === undefined ? defaultValue : v;
	});

	const setValue = useCallback((value: T) => {
		storage.set(key, value);
		setStateValue(value);
	}, [storage]);

	return [value, setValue] as const;
}



