import { useRef, useState } from "react";

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
	maxRetries: number;
	controller: AbortController;
};

export interface UploadTransport {
	upload(
		task: UploadTask,
		onProgress: (p: number, speedMbps: number) => void,
	): Promise<void>;
}

export type UploadQueueOptions = {
	concurrency?: number;
	autoRetry?: boolean;
};

const DEFAULT_QUEUE_OPTIONS: Required<UploadQueueOptions> = {
	concurrency: 3,
	autoRetry: false,
};

export type UploadTaskOptions = Partial<
	Pick<UploadTask, "priority" | "maxRetries">
>;

const DEFAULT_TASK_OPTIONS: Required<UploadTaskOptions> = {
	priority: 0,
	maxRetries: 3,
};

export function useUploadQueue(
	transport: UploadTransport,
	options?: UploadQueueOptions,
) {
	const opts = { ...DEFAULT_QUEUE_OPTIONS, ...options };

	const queueRef = useRef<UploadTask[]>([]);
	const headRef = useRef(0);
	const activeRef = useRef(0);
	const pausedRef = useRef(false);

	const [items, setItems] = useState<UploadItem[]>([]);

	//#region CORE
	const process = () => {
		if (pausedRef.current) return;

		while (
			activeRef.current < opts.concurrency &&
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
			cleanup();
			process();
		}
	};
	//#endregion

	//#region HELPERS
	const upload = (task: UploadTask) =>
		transport.upload(task, (progress, speedMbps) =>
			updateItem(task.id, { progress, speedMbps }),
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

	const cleanup = () => {
		if (headRef.current > 50) {
			queueRef.current = queueRef.current.slice(headRef.current);
			headRef.current = 0;
		}
	};

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
		const taskOptions = { ...DEFAULT_TASK_OPTIONS, ...options };
		files.forEach((file, index) => {
			const id = randomText({ prefix: "upload_" });
			const controller = new AbortController();

			const task: UploadTask = {
				id,
				file,
				controller,
				retries: 0,
				...taskOptions,
				priority: taskOptions.priority ?? index,
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
	};
}
