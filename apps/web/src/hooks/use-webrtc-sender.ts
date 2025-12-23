import { type RefObject, useRef } from "react";
import type { UploadTask } from "@/hooks/use-upload-queue";
import type { ChannelMessage } from "@/types/webrtc";

const CHUNK_SIZE = 16 * 1024; // 16KB

export function useWebRtcSender(peerRef: RefObject<RTCPeerConnection | null>) {
	const channelsRef = useRef<Map<string, RTCDataChannel>>(new Map());

	//#region HELPERS
	const waitBufferedLow = (channel: RTCDataChannel) =>
		new Promise<void>((resolve) => {
			channel.bufferedAmountLowThreshold = 2 * CHUNK_SIZE;
			channel.onbufferedamountlow = () => resolve();
		});

	const sendMessage = (channel: RTCDataChannel, payload: ChannelMessage) => {
		channel.send(JSON.stringify(payload));
	};
	//#endregion

	//#region PUBLIC API
	const upload = async (task: UploadTask, onProgress: (p: number) => void) => {
		if (!peerRef.current) throw new Error("Not connected");

		const channel = peerRef.current.createDataChannel(task.id);
		channel.binaryType = "arraybuffer";
		channelsRef.current.set(task.id, channel);

		sendMessage(channel, {
			type: "META",
			id: task.id,
			meta: {
				name: task.file.name,
				size: task.file.size,
				mime: task.file.type,
			},
		});

		const total = task.file.size;
		let offset = 0;

		return new Promise<void>((resolve, reject) => {
			channel.onopen = async () => {
				while (offset < total) {
					const chunk = task.file.slice(offset, offset + CHUNK_SIZE);
					const buffer = await chunk.arrayBuffer();

					channel.send(buffer);
					offset += CHUNK_SIZE;

					onProgress(Math.round((offset / total) * 100));

					// backpressure
					if (channel.bufferedAmount > 4 * CHUNK_SIZE) {
						await waitBufferedLow(channel);
					}
				}

				sendMessage(channel, { type: "EOF", id: task.id });
			};

			channel.onmessage = (e) => {
				if (e.data === "CANCEL") {
					channel.close();
					reject("cancelled by receiver");
				}

				if (e.data === "ACK") {
					channel.close();
					resolve();
				}
			};

			channel.onerror = () => reject("WebRTC error");

			task.controller.signal.addEventListener("abort", () => {
				channel.close();
				reject("cancelled");
			});
		});
	};

	const cancel = (taskId: string) => {
		channelsRef.current.get(taskId)?.close();
	};
	//#endregion

	return { upload, cancel };
}
