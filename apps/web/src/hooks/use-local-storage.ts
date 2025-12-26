import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";

export function useLocalStorage<T = null>(
	key: string,
	initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
	const readValue = useCallback((): T => {
		if (typeof window === "undefined") {
			console.error("[LocalStorage] Window is undefined");
			return initialValue instanceof Function ? initialValue() : initialValue;
		}
		try {
			const item = window.localStorage.getItem(key);
			if (!item) {
				const toSave =
					initialValue instanceof Function ? initialValue() : initialValue;
				window.localStorage.setItem(key, JSON.stringify(toSave));
				return toSave;
			}
			return JSON.parse(item) as T;
		} catch (error) {
			console.error(`[LocalStorage] Error reading key ${key}: `, error);
			return initialValue instanceof Function ? initialValue() : initialValue;
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
					event.newValue
						? JSON.parse(event.newValue)
						: initialValue instanceof Function
							? initialValue()
							: initialValue,
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
