import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChannelMessage, FileMeta } from "@/types/webrtc";
import { sendMessage } from "@/utils/webrtc";

export type ReceiveItem = {
	id: string;
	meta: FileMeta;
	progress: number;
	speedMbps: number;
	status: "receiving" | "done" | "error" | "cancelled";
	file?: File;
	cancel: () => void;
	remove: () => void;
};

type ReceiveTask = {
	id: string;
	meta: FileMeta;
	received: number;
	chunks: ArrayBuffer[];

	windowBytes: number;
	startTime: number;
	lastTick: number;
};

export function useWebRtcReceiver(peer: RTCPeerConnection | null) {
	const tasksRef = useRef<Map<string, ReceiveTask>>(new Map());
	const channelsRef = useRef<Map<string, RTCDataChannel>>(new Map());

	const [items, setItems] = useState<ReceiveItem[]>([]);

	//#region HELPERS
	const updateItem = useCallback((id: string, update: Partial<ReceiveItem>) => {
		setItems((prev) =>
			prev.map((i) => (i.id === id ? { ...i, ...update } : i)),
		);
	}, []);

	const handleControl = useCallback(
		(channel: RTCDataChannel, data: string) => {
			const msg: ChannelMessage = JSON.parse(data);
			console.log("[Receiver] Message received:", msg);

			if (channel.label !== msg.id) return;

			if (msg.type === "META") {
				const now = performance.now();
				tasksRef.current.set(msg.id, {
					id: msg.id,
					meta: msg.meta,
					received: 0,
					chunks: [],

					windowBytes: 0,
					startTime: now,
					lastTick: now,
				});

				const item: ReceiveItem = {
					id: msg.id,
					meta: msg.meta,
					progress: 0,
					speedMbps: 0,
					status: "receiving",
					cancel: () => {
						const channel = channelsRef.current.get(msg.id);
						if (channel) {
							sendMessage(channel, { type: "CANCEL", id: msg.id });
							setItems((prev) => prev.filter((i) => i.id !== msg.id));
							tasksRef.current.delete(msg.id);
						}
					},
					remove: () => {
						setItems((prev) => prev.filter((i) => i.id !== msg.id));
						tasksRef.current.delete(msg.id);
					},
				};
				setItems((prev) => [...prev, item]);
			}

			if (msg.type === "CANCEL") {
				toast.info("Download cancelled", {
					description: "File transfer was cancelled by the sender.",
				});
				setItems((prev) => prev.filter((i) => i.id !== msg.id));
				channel.close();
				tasksRef.current.delete(msg.id);
			}

			if (msg.type === "EOF") {
				const task = tasksRef.current.get(msg.id);
				if (!task) return;

				const file = new File(task.chunks, task.meta.name, {
					type: task.meta.mime,
				});
				tasksRef.current.delete(msg.id);

				sendMessage(channel, { type: "ACK", id: msg.id });
				updateItem(msg.id, { file, status: "done", progress: 100 });
			}
		},
		[updateItem],
	);

	const handleBinary = useCallback(
		(channel: RTCDataChannel, data: ArrayBuffer) => {
			const task = tasksRef.current.get(channel.label);
			if (!task || data instanceof ArrayBuffer === false) return;

			task.chunks.push(data);
			task.received += data.byteLength;

			task.windowBytes += data.byteLength;
			const now = performance.now();
			let speedMbps: number | undefined;

			if (now - task.lastTick >= 1000) {
				const elapsedSec = (now - task.lastTick) / 1000;
				const speedBps = task.windowBytes / elapsedSec;
				speedMbps = Math.round((speedBps * 8) / (1024 * 1024));

				task.windowBytes = 0;
				task.lastTick = now;
			}

			const progress = Math.round((task.received / task.meta.size) * 100);

			updateItem(channel.label, {
				progress,
				...(speedMbps !== undefined && { speedMbps }),
			});
		},
		[updateItem],
	);

	const cleanup = useCallback(() => {
		channelsRef.current.forEach((channel) => {
			if (channel.readyState !== "closed") {
				channel.close();
			}
		});
		channelsRef.current.clear();
		tasksRef.current.clear();
	}, []);
	//#endregion

	//#region CORE
	useEffect(() => {
		if (!peer) return;

		peer.ondatachannel = (e) => {
			console.log("[Receiver] Channel received:", e.channel);
			const channel = e.channel;
			const id = channel.label;

			channelsRef.current.set(id, channel);
			channel.binaryType = "arraybuffer";

			channel.onmessage = (ev) => {
				if (typeof ev.data === "string") {
					handleControl(channel, ev.data);
					return;
				}

				handleBinary(channel, ev.data);
			};

			channel.onclose = () => {
				console.log("[Receiver] Closed:", channel.label);

				channelsRef.current.delete(id);
				tasksRef.current.delete(id);
			};

			channel.onerror = () => {
				updateItem(id, { status: "error" });
			};
		};

		return () => {
			if (peer) peer.ondatachannel = null;
			cleanup();
		};
	}, [peer, updateItem, handleBinary, handleControl, cleanup]);
	//#endregion

	return { items };
}
