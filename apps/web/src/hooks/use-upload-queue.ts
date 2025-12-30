import { useCallback, useRef, useState } from "react";
import {
	type AppSettingsState,
	useAppSettings,
} from "@/hooks/use-app-settings";
import { delay } from "@/utils/delay";
import { randomText } from "@/utils/random-text";

export type UploadItem = {
	id: string;
	file: File;
	progress: number;
	speedMbps: number;
	status: "waiting" | "uploading" | "done" | "error" | "cancelled";
	error?: string;
	cancel: () => void;
	remove: () => void;
	retry: () => void;
};

export type UploadTask = {
	id: string;
	file: File;
	priority: number;
	retries: number;
	maxRetries: AppSettingsState["maxRetries"];
	controller: AbortController;

	windowBytes: number;
	startTime: number;
	lastTick: number;
};

export interface UploadTransport {
	upload(
		task: UploadTask,
		onProgress: (p: number, speedMbps?: number) => void,
	): Promise<void>;
}

export type UploadQueueOptions = Partial<
	Pick<AppSettingsState, "maxConcurrency" | "autoRetry">
>;

export type UploadTaskOptions = Partial<
	Pick<UploadTask, "priority" | "maxRetries">
>;

export function useUploadQueue(
	transport: UploadTransport,
	options?: UploadQueueOptions,
) {
	const { appSettings } = useAppSettings();

	const opts: Required<UploadQueueOptions> = {
		maxConcurrency: appSettings.maxConcurrency,
		autoRetry: appSettings.autoRetry,
		...options,
	};

	const queueRef = useRef<UploadTask[]>([]);
	const headRef = useRef(0);
	const activeRef = useRef(0);
	const pausedRef = useRef(false);

	const [items, setItems] = useState<UploadItem[]>([]);

	//#region CORE
	const process = () => {
		if (pausedRef.current) return;

		while (
			activeRef.current < opts.maxConcurrency &&
			headRef.current < queueRef.current.length
		) {
			const task = queueRef.current[headRef.current++];
			activeRef.current++;
			run(task);
		}
	};

	const run = async (task: UploadTask) => {
		updateItem(task.id, { status: "uploading" });

		try {
			await upload(task);
			updateItem(task.id, { status: "done", progress: 100 });
		} catch (error) {
			console.log("[Queue] Error:", error);
			if (task.controller.signal.aborted) {
				updateItem(task.id, { status: "cancelled" });
				return;
			}
			if (opts.autoRetry && task.retries < task.maxRetries) {
				// Auto-retry
				task.retries++;
				updateItem(task.id, {
					status: "waiting",
					progress: 0,
					error: `Retrying... (${task.retries})`,
				});
				await delay(Math.min(1000 * 2 ** task.retries, 10000));
				requeue(task);
				return;
			}
			updateItem(task.id, {
				status: "error",
				error: error instanceof Error ? error.message : String(error),
			});
		} finally {
			activeRef.current--;
			if (headRef.current > 50) {
				queueRef.current = queueRef.current.slice(headRef.current);
				headRef.current = 0;
			}
			process();
		}
	};
	//#endregion

	//#region HELPERS
	const upload = (task: UploadTask) =>
		transport.upload(task, (progress, speedMbps) =>
			updateItem(task.id, {
				progress,
				...(speedMbps !== undefined && { speedMbps }),
			}),
		);

	const requeue = (task: UploadTask) => {
		queueRef.current.push(task);
		sortQueue();
	};

	const sortQueue = () => {
		const pending = queueRef.current.slice(headRef.current);
		pending.sort((a, b) => b.priority - a.priority);
		queueRef.current.splice(headRef.current, pending.length, ...pending);
	};

	const cleanup = useCallback(() => {
		queueRef.current = [];
		headRef.current = 0;
		activeRef.current = 0;
		pausedRef.current = false;
		setItems([]);
	}, []);

	const updateItem = (id: string, item: Partial<UploadItem>) => {
		setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...item } : i)));
	};

	const removeTask = (id: string) => {
		const task = queueRef.current.find((t) => t.id === id);
		if (!task) return;

		task.controller.abort();

		queueRef.current = queueRef.current.filter((t) => t.id !== id);
		setItems((prev) => prev.filter((i) => i.id !== id));
	};

	const retryTask = (task: UploadTask) => {
		const controller = new AbortController();

		requeue({
			...task,
			controller,
			retries: 0,
		});
		updateItem(task.id, {
			status: "waiting",
			progress: 0,
			error: undefined,
			cancel: () => controller.abort(),
		});
		process();
	};
	//#endregion

	//#region PUBLIC API
	const addFiles = (files: File[], options?: UploadTaskOptions) => {
		const opts: Required<UploadTaskOptions> = {
			maxRetries: appSettings.maxRetries,
			priority: 0,
			...options,
		};
		files.forEach((file, index) => {
			const id = randomText({ prefix: "upload_" });
			const controller = new AbortController();
			const now = performance.now();

			const task: UploadTask = {
				id,
				file,
				controller,
				retries: 0,
				windowBytes: 0,
				startTime: now,
				lastTick: now,
				...opts,
				priority: opts.priority ?? index,
			};

			queueRef.current.push(task);
			sortQueue();

			const item: UploadItem = {
				id,
				file,
				progress: 0,
				speedMbps: 0,
				status: "waiting",
				cancel: () => controller.abort(),
				remove: () => removeTask(id),
				retry: () => retryTask(task),
			};
			setItems((prev) => [...prev, item]);

			process();
		});
	};
	//#endregion

	return {
		items,
		addFiles,
		pause: () => {
			pausedRef.current = true;
		},
		resume: () => {
			pausedRef.current = false;
			process();
		},
		cleanup,
	};
}
