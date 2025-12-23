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

	function waitForOpen(channel: RTCDataChannel): Promise<void> {
		if (channel.readyState === "open") return Promise.resolve();

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("DataChannel open timeout"));
			}, 10000);

			channel.onopen = () => {
				clearTimeout(timeout);
				resolve();
			};

			channel.onerror = () => {
				clearTimeout(timeout);
				reject(new Error("DataChannel error before open"));
			};
		});
	}

	//#endregion

	//#region PUBLIC API
	const upload: UploadTransport["upload"] = async (task, onProgress) => {
		console.log("[Sender] Uploading:", { task, peer });
		if (!peer) throw new Error("Not connected");

		const channel = peer.createDataChannel(task.id);
		channel.binaryType = "arraybuffer";
		if (opts.speedLimit) channel.bufferedAmountLowThreshold = opts.speedLimit;

		channelsRef.current.set(task.id, channel);

		console.log("[DEBUG] Channel:", { peer, channel });

		await waitForOpen(channel);

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

			channel.onmessage = (ev) => {
				if (typeof ev.data === "string") {
					const msg: ChannelMessage = JSON.parse(ev.data);
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
