import { useCallback, useEffect, useRef, useState } from "react";

import type { ChannelMessage, FileMeta } from "@/types/webrtc";
import { sendMessage } from "@/utils/webrtc";

export type ReceiveItem = {
	id: string;
	meta: FileMeta;
	progress: number;
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
				tasksRef.current.set(msg.id, {
					id: msg.id,
					meta: msg.meta,
					received: 0,
					chunks: [],
				});

				const item: ReceiveItem = {
					id: msg.id,
					meta: msg.meta,
					progress: 0,
					status: "receiving",
					cancel: () => {
						const channel = channelsRef.current.get(msg.id);
						if (channel) {
							sendMessage(channel, { type: "CANCEL", id: msg.id });
							updateItem(msg.id, { status: "cancelled" });
						}
					},
					remove: () => {
						setItems((prev) => prev.filter((i) => i.id !== msg.id));
						tasksRef.current.delete(msg.id);
					},
				};
				setItems((prev) => [...prev, item]);
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

			const progress = Math.round((task.received / task.meta.size) * 100);

			updateItem(channel.label, { progress });
		},
		[updateItem],
	);
	//#endregion

	//#region CORE
	useEffect(() => {
		if (!peer) return;

		peer.ondatachannel = (e) => {
			console.log("[DEBUG] Channel:", e.channel);
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
				channelsRef.current.delete(id);
				tasksRef.current.delete(id);
			};

			channel.onerror = () => {
				updateItem(id, { status: "error" });
			};
		};

		return () => {
			if (peer) peer.ondatachannel = null;
			channelsRef.current.forEach((c) => {
				c.close();
			});
			channelsRef.current.clear();
			tasksRef.current.clear();
		};
	}, [peer, updateItem, handleBinary, handleControl]);
	//#endregion

	return { items };
}
