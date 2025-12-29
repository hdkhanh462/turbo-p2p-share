import { useRef } from "react";
import { toast } from "sonner";
import {
	type AppSettingsState,
	useAppSettings,
} from "@/hooks/use-app-settings";
import type { UploadTransport } from "@/hooks/use-upload-queue";
import type { ChannelMessage } from "@/types/webrtc";
import { sendMessage } from "@/utils/webrtc";

type SenderOptions = Partial<
	Pick<AppSettingsState, "chunkSize" | "maxBufferedAmount">
>;

export function useWebRtcSender(
	peer: RTCPeerConnection | null,
	options?: SenderOptions,
) {
	const { appSettings } = useAppSettings();

	const opts: Required<SenderOptions> = {
		chunkSize: appSettings.chunkSize,
		maxBufferedAmount: appSettings.maxBufferedAmount,
		...options,
	};
	const channelsRef = useRef<Map<string, RTCDataChannel>>(new Map());

	//#region HELPERS
	const waitBufferedLow = (channel: RTCDataChannel) =>
		new Promise<void>((resolve) => {
			const onLow = () => {
				channel.removeEventListener("bufferedamountlow", onLow);
				resolve();
			};
			channel.addEventListener("bufferedamountlow", onLow);
		});

	//#endregion

	//#region PUBLIC API
	const upload: UploadTransport["upload"] = async (task, onProgress) => {
		if (!peer) throw new Error("Not connected");

		const channel = peer.createDataChannel(task.id);
		channel.binaryType = "arraybuffer";
		channel.bufferedAmountLowThreshold = opts.maxBufferedAmount / 2;

		channelsRef.current.set(task.id, channel);

		const total = task.file.size;
		let offset = 0;

		return new Promise<void>((resolve, reject) => {
			console.log("[Sender] Data channel created:", channel.label);
			channel.onopen = async () => {
				console.log("[Sender] Channel opened:", channel.label);

				if (channel.bufferedAmount > opts.maxBufferedAmount) {
					await waitBufferedLow(channel);
				}

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

						// backpressure
						if (channel.bufferedAmount > opts.maxBufferedAmount) {
							await waitBufferedLow(channel);
						}

						const chunk = task.file.slice(offset, offset + opts.chunkSize);
						const buffer = await chunk.arrayBuffer();

						channel.send(buffer);
						offset += buffer.byteLength;

						if (offset % (512 * 1024) === 0) {
							await new Promise((r) => setTimeout(r, 0));
						}

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
					}

					sendMessage(channel, { type: "EOF", id: task.id });
					console.log("[Sender] Sending file completed:", task.id);
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") {
						sendMessage(channel, { type: "CANCEL", id: task.id });
						reject("Cancelled by sender");
						return;
					}

					toast.error("Upload error", {
						description: `Failed to upload ${task.file.name}: ${
							(error as Error).message
						}`,
					});

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
						toast.info("Upload cancelled", {
							description: "File transfer was cancelled by the receiver.",
						});
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

	const cleanup = () => {
		channelsRef.current.forEach((channel) => {
			if (channel.readyState !== "closed") {
				channel.close();
			}
		});
		channelsRef.current.clear();
	};
	//#endregion

	return { upload, cleanup };
}
