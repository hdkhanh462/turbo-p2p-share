import { useLocalStorage } from "@/hooks/use-local-storage";

export type AppSettingsState = {
	chunkSize: number;
	maxRetries: number;
	maxConcurrency: number;
	maxFilesSelect: number;
	maxBufferedAmount: number;
	autoRetry: boolean;
	showSpeed?: boolean;
	autoUpload?: boolean;
};

export const useAppSettings = () => {
	const [appSettings, setAppSettings] = useLocalStorage<AppSettingsState>(
		"app-settings",
		{
			chunkSize: 256 * 1024,
			maxRetries: 3,
			maxConcurrency: 3,
			maxFilesSelect: 5,
			maxBufferedAmount: 512 * 1024,
			showSpeed: true,
			autoRetry: false,
		},
	);

	return { appSettings, setAppSettings };
};
