import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { ChannelMessage, FileMeta } from "@/types/webrtc";

type ReceiveItem = {
	id: string;
	meta: FileMeta;
	progress: number;
	file?: File;
};

type ReceiveTask = {
	id: string;
	meta: FileMeta;
	received: number;
	chunks: ArrayBuffer[];
};

export function useWebRtcReceiver(
	peerRef: RefObject<RTCPeerConnection | null>,
) {
	const tasksRef = useRef<Map<string, ReceiveTask>>(new Map());
	const channelsRef = useRef<Map<string, RTCDataChannel>>(new Map());

	const [items, setItems] = useState<ReceiveItem[]>([]);

	//#region HELPERS
	const updateItem = useCallback((id: string, update: Partial<ReceiveItem>) => {
		setItems((prev) =>
			prev.map((i) => (i.id === id ? { ...i, ...update } : i)),
		);
	}, []);
	//#endregion

	useEffect(() => {
		if (!peerRef.current) return;

		peerRef.current.ondatachannel = (e) => {
			const channel = e.channel;
			const id = channel.label;

			channelsRef.current.set(id, channel);
			channel.binaryType = "arraybuffer";

			channel.onmessage = (ev) => {
				if (typeof ev.data === "string") {
					const msg: ChannelMessage = JSON.parse(ev.data);

					if (msg.type === "META") {
						tasksRef.current.set(msg.id, {
							id: msg.id,
							meta: msg.meta,
							received: 0,
							chunks: [],
						});

						updateItem(msg.id, { meta: msg.meta, progress: 0 });
					}

					if (msg.type === "EOF") {
						const task = tasksRef.current.get(msg.id);
						if (!task) return;

						const file = new File(task.chunks, task.meta.name, {
							type: task.meta.mime,
						});
						tasksRef.current.delete(msg.id);

						updateItem(msg.id, { file, progress: 100 });

						channel.send("ACK");
					}

					return;
				}

				// BINARY CHUNK
				const task = tasksRef.current.get(id);
				if (!task) return;

				task.chunks.push(ev.data);
				task.received += ev.data.byteLength;

				const progress = Math.round((task.received / task.meta.size) * 100);

				updateItem(id, { progress });
			};

			channel.onclose = () => {
				channelsRef.current.delete(id);
				tasksRef.current.delete(id);
			};
		};

		return () => {
			if (peerRef.current) peerRef.current.ondatachannel = null;
			channelsRef.current.forEach((c) => {
				c.close();
			});
			channelsRef.current.clear();
			tasksRef.current.clear();
		};
	}, [peerRef, updateItem]);

	//#region PUBLIC API
	const cancelReceive = (id: string) => {
		const channel = channelsRef.current.get(id);
		if (channel) channel.send("CANCEL");
	};
	//#endregion

	return { items, cancelReceive };
}
