import { useRef } from "react";

import type { UploadTransport } from "@/hooks/use-upload-queue";
import type { ChannelMessage } from "@/types/webrtc";
import { sendMessage } from "@/utils/webrtc";

type SenderOptions = {
	chunkSize?: number;
	maxBufferedAmount?: number;
};

const DEFAULT_SENDER_OPTIONS: Required<SenderOptions> = {
	chunkSize: 256 * 1024,
	maxBufferedAmount: 512 * 1024,
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
			channel.onbufferedamountlow = () => resolve();
		});
	//#endregion

	//#region PUBLIC API
	const upload: UploadTransport["upload"] = async (task, onProgress) => {
		if (!peer) throw new Error("Not connected");

		const channel = peer.createDataChannel(task.id);
		channel.binaryType = "arraybuffer";
		channel.bufferedAmountLowThreshold = opts.maxBufferedAmount;

		channelsRef.current.set(task.id, channel);

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

				console.log("[Sender] Sending file:", task.file);

				try {
					while (offset < total) {
						if (task.controller.signal.aborted) {
							throw new DOMException("Canceled", "AbortError");
						}

						const chunk = task.file.slice(offset, offset + opts.chunkSize);
						const buffer = await chunk.arrayBuffer();

						channel.send(buffer);
						offset += opts.chunkSize;

						task.windowBytes += buffer.byteLength;
						const now = performance.now();

						let speedMbps: number | undefined;

						if (now - task.lastTick >= 1000) {
							const speedBps =
								task.windowBytes / ((now - task.lastTick) / 1000);
							speedMbps = Math.round((speedBps * 8) / (1024 * 1024));
							task.windowBytes = 0;
							task.lastTick = now;
						}

						onProgress(Math.round((offset / total) * 100), speedMbps);

						// backpressure
						if (channel.bufferedAmount > opts.maxBufferedAmount) {
							await waitBufferedLow(channel);
						}
					}

					sendMessage(channel, { type: "EOF", id: task.id });
					console.log("[Sender] Sending file completed:", task.id);
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") {
						sendMessage(channel, { type: "CANCEL", id: task.id });
						reject("Cancelled by sender");
						return;
					}

					reject(error);
				}
			};

			channel.onmessage = (ev) => {
				if (typeof ev.data === "string") {
					const msg: ChannelMessage = JSON.parse(ev.data);
					console.log("[Sender] Message received:", msg);

					if (task.id !== msg.id) return;

					if (msg.type === "CANCEL") {
						task.controller.abort();
						reject("Cancelled by receiver");
					}

					if (msg.type === "ACK") {
						channel.close();
						resolve();
					}
				}
			};

			channel.onerror = (e) => reject(e);
			channel.onclose = () => console.log("[Sender] Closed:", channel.label);
		});
	};
	//#endregion

	return { upload };
}
