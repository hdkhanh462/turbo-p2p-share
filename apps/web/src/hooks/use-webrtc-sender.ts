import { type RefObject, useRef } from "react";

import type { UploadTransport } from "@/hooks/use-upload-queue";
import type { ChannelMessage } from "@/types/webrtc";

type UseWebRtcSenderOptions = {
	chunkSize?: number;
	speedLimit?: number;
};

const DEFAULT_OPTIONS = {
	chunkSize: 16 * 1024, // 16KB
};

export function useWebRtcSender(
	peerRef: RefObject<RTCPeerConnection | null>,
	options?: UseWebRtcSenderOptions,
) {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const channelsRef = useRef<Map<string, RTCDataChannel>>(new Map());

	//#region HELPERS
	const waitBufferedLow = (channel: RTCDataChannel) =>
		new Promise<void>((resolve) => {
			channel.bufferedAmountLowThreshold = 2 * opts.chunkSize;
			channel.onbufferedamountlow = () => resolve();
		});

	const sendMessage = (channel: RTCDataChannel, payload: ChannelMessage) => {
		channel.send(JSON.stringify(payload));
	};
	//#endregion

	//#region PUBLIC API
	const upload: UploadTransport["upload"] = async (task, onProgress) => {
		if (!peerRef.current) throw new Error("Not connected");

		const channel = peerRef.current.createDataChannel(task.id);
		channel.binaryType = "arraybuffer";
		if (opts.speedLimit) channel.bufferedAmountLowThreshold = opts.speedLimit;

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
					const chunk = task.file.slice(offset, offset + opts.chunkSize);
					const buffer = await chunk.arrayBuffer();

					channel.send(buffer);
					offset += opts.chunkSize;

					onProgress(Math.round((offset / total) * 100));

					// backpressure
					if (channel.bufferedAmount > 4 * opts.chunkSize) {
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

	const cancel: UploadTransport["cancel"] = (taskId) => {
		channelsRef.current.get(taskId)?.close();
	};
	//#endregion

	return { upload, cancel };
}
