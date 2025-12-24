import { useRef } from "react";

import type { UploadTransport } from "@/hooks/use-upload-queue";
import type { ChannelMessage } from "@/types/webrtc";
import { sendMessage } from "@/utils/webrtc";

type SenderOptions = {
	chunkSize?: number;
	speedLimit?: number;
};

const DEFAULT_SENDER_OPTIONS: Required<Pick<SenderOptions, "chunkSize">> = {
	chunkSize: 16 * 1024, // 16KB
};

export function useWebRtcSender(
	peer: RTCPeerConnection | null,
	options?: SenderOptions,
) {
	const opts = { ...DEFAULT_SENDER_OPTIONS, ...options };
	const channelsRef = useRef<Map<string, RTCDataChannel>>(new Map());

	//#region HELPERS
	const waitBufferedLow = (channel: RTCDataChannel) =>
		new Promise<void>((resolve) => {
			channel.bufferedAmountLowThreshold = 2 * opts.chunkSize;
			channel.onbufferedamountlow = () => resolve();
		});
	//#endregion

	//#region PUBLIC API
	const upload: UploadTransport["upload"] = async (task, onProgress) => {
		if (!peer) throw new Error("Not connected");

		const channel = peer.createDataChannel(task.id);
		channel.binaryType = "arraybuffer";
		if (opts.speedLimit) channel.bufferedAmountLowThreshold = opts.speedLimit;

		channelsRef.current.set(task.id, channel);

		console.log("[DEBUG] Channel open:", channel);

		const total = task.file.size;
		let offset = 0;

		return new Promise<void>((resolve, reject) => {
			channel.onopen = async () => {
				sendMessage(channel, {
					type: "META",
					id: task.id,
					meta: {
						name: task.file.name,
						size: task.file.size,
						mime: task.file.type,
					},
				});

				console.log("[DEBUG] Send meta");

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
				console.log("[DEBUG] Send EOF");
			};

			channel.onmessage = (ev) => {
				if (typeof ev.data === "string") {
					const msg: ChannelMessage = JSON.parse(ev.data);
					console.log("[DEBUG] onmessage:", msg);

					if (task.id !== msg.id) return;

					if (msg.type === "CANCEL") {
						channel.close();
						reject("cancelled by receiver");
					}

					if (msg.type === "ACK") {
						channel.close();
						resolve();
					}
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
