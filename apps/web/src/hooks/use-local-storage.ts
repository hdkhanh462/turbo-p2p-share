"use client";

import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";

export function useLocalStorage<T = null>(
	key: string,
	initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
	const readValue = useCallback((): T => {
		if (typeof window === "undefined") return initialValue;
		try {
			const item = window.localStorage.getItem(key);
			return item ? (JSON.parse(item) as T) : initialValue;
		} catch (error) {
			console.error(`[LocalStorage] Error reading key ${key}: `, error);
			return initialValue;
		}
	}, [key, initialValue]);

	const [storedValue, setStoredValue] = useState<T>(readValue);

	const setValue: Dispatch<SetStateAction<T>> = (value) => {
		try {
			const newValue = value instanceof Function ? value(storedValue) : value;
			setStoredValue(newValue);
			if (typeof window !== "undefined") {
				window.localStorage.setItem(key, JSON.stringify(newValue));
				window.dispatchEvent(new Event("local-storage"));
			}
		} catch (error) {
			console.error(`[LocalStorage] Error setting key ${key}: `, error);
		}
	};

	useEffect(() => {
		const handleStorageChange = (event: StorageEvent | Event) => {
			if (event instanceof StorageEvent) {
				if (event.key !== key) return;
				setStoredValue(
					event.newValue ? JSON.parse(event.newValue) : initialValue,
				);
			} else {
				setStoredValue(readValue());
			}
		};

		window.addEventListener("storage", handleStorageChange);
		window.addEventListener("local-storage", handleStorageChange);

		return () => {
			window.removeEventListener("storage", handleStorageChange);
			window.removeEventListener("local-storage", handleStorageChange);
		};
	}, [key, initialValue, readValue]);

	return [storedValue, setValue];
}
