import { useLocalStorage } from "@/hooks/use-local-storage";

export type AppSettingsState = {
	chunkSize: number;
	maxRetries: number;
	maxConcurrency: number;
	maxFilesSelect: number;
	maxBufferedAmount: number;
	autoRetry: boolean;
	autoUpload: boolean;
	showSpeed: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettingsState = {
	chunkSize: 32 * 1024,
	maxRetries: 3,
	maxConcurrency: 2,
	maxFilesSelect: 5,
	maxBufferedAmount: 2 * 1024 * 1024,
	showSpeed: true,
	autoRetry: false,
	autoUpload: false,
};

export const useAppSettings = () => {
	const [appSettings, setAppSettings] = useLocalStorage<AppSettingsState>(
		"app-settings",
		DEFAULT_APP_SETTINGS,
	);

	return { appSettings, setAppSettings };
};
