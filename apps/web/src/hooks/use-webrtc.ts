import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SocketTyped } from "@/hooks/use-socket";
import type { SignalPayload, TransferData } from "@/types/webrtc";

const CHUNK_SIZE = 16 * 1024; // 16KB

type IncomingData = {
	chunks: ArrayBuffer[];
	data: TransferData | null;
};

type Props = {
	socket: SocketTyped | null;
};

export const useWebRTC = ({ socket }: Props) => {
	const pcRef = useRef<RTCPeerConnection | null>(null);
	const channelRef = useRef<RTCDataChannel | null>(null);

	const incomingData = useRef<IncomingData>({ chunks: [], data: null });
	const abortControllers = useRef<Map<string, AbortController>>(new Map());

	const [roomId, setRoomId] = useState<string | null>(null);
	const [connected, setConnected] = useState(false);
	const [sentFiles, setSentFiles] = useState<TransferData[]>([]);
	const [receivedFiles, setReceivedFiles] = useState<TransferData[]>([]);

	const modifyFileStatus = useCallback(
		(id: string, type: "sent" | "received", data: Partial<TransferData>) => {
			if (type === "sent")
				setSentFiles((prev) =>
					prev.map((f) => (f.id === id ? { ...f, ...data } : f)),
				);
			else
				setReceivedFiles((prev) =>
					prev.map((f) => (f.id === id ? { ...f, ...data } : f)),
				);
		},
		[],
	);

	const setupDataChannel = useCallback(
		(channel: RTCDataChannel) => {
			console.info("[WebRTC] Offer received:", roomId);

			channel.binaryType = "arraybuffer";
			channelRef.current = channel;

			channel.onmessage = (e) => {
				if (typeof e.data === "string") {
					const msg: SignalPayload = JSON.parse(e.data);

					if (msg.type === "meta") {
						console.log(
							`[WebRTC] Incoming file ${msg.data.id}:`,
							msg.data.meta.name,
						);
						incomingData.current = { chunks: [], data: msg.data };
						const receivedData = msg.data;
						setReceivedFiles((prev) => [
							...prev,
							{ ...receivedData, status: "receiving" },
						]);

						return;
					}

					// End of transfer (completed or canceled)
					if (msg.type === "canceled" || msg.type === "completed") {
						if (msg.type === "canceled") {
							// On sender side
							if (msg.by === "receiver") {
								console.log("[WebRTC] Receiver canceled the transfer:", msg.id);
								const controller = abortControllers.current.get(msg.id);
								if (controller) {
									controller.abort();
									modifyFileStatus(msg.id, "sent", { status: "canceled" });
								}
							}

							// On receiver side
							if (msg.by === "sender") {
								console.log("[WebRTC] Sender canceled the transfer:", msg.id);
								setReceivedFiles((prev) => prev.filter((f) => f.id !== msg.id));
							}
						}

						if (!incomingData.current.data) return;
						const data = incomingData.current.data;

						if (msg.type === "completed") {
							const file = new File(
								incomingData.current.chunks,
								data.meta.name,
								{
									type: data.meta.mime,
								},
							);
							modifyFileStatus(data.id, "received", {
								status: "completed",
								progress: 100,
								file,
							});
						}

						// Reset incoming data
						if (msg.id === data.id) {
							incomingData.current = { chunks: [], data: null };
						}
					}
				} else {
					// Handle incoming file chunk
					if (!incomingData.current.data) return;
					incomingData.current.chunks.push(e.data);
					const receivedSize = incomingData.current.chunks.reduce(
						(acc, c) => acc + c.byteLength,
						0,
					);
					const data = incomingData.current.data;
					const progress = Math.floor((receivedSize / data.meta.size) * 100);
					modifyFileStatus(data.id, "received", { progress });
				}
			};
		},
		[roomId, modifyFileStatus],
	);

	const createPeerConnection = useCallback(
		(roomId: string) => {
			console.info("[WebRTC] Create PeerConnection:", roomId);
			const pc = new RTCPeerConnection({ iceServers: [] });

			pc.onicecandidate = (e) => {
				if (e.candidate) {
					socket?.emit("file:candidate", { roomId, candidate: e.candidate });
				}
			};

			pc.onconnectionstatechange = () => {
				console.debug("[WebRTC] Connection state:", pc.connectionState);
				setConnected(pc.connectionState === "connected");
			};

			pc.ondatachannel = (e) => {
				console.info("[WebRTC] DataChannel received");
				setupDataChannel(e.channel);
			};

			pcRef.current = pc;
			return pc;
		},
		[socket, setupDataChannel],
	);

	useEffect(() => {
		socket?.on("file:offer", async ({ roomId, sdp }) => {
			console.info("[WebRTC] Offer received:", {
				roomId,
				hasPC: !!pcRef.current,
			});

			const pc = createPeerConnection(roomId);
			await pc.setRemoteDescription(sdp);

			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);

			socket.emit("file:answer", { roomId, sdp: answer });
		});

		socket?.on("file:answer", async ({ sdp }) => {
			console.info("[WebRTC] Answer received");
			await pcRef.current?.setRemoteDescription(sdp);
		});

		socket?.on("file:candidate", async ({ candidate }) => {
			await pcRef.current?.addIceCandidate(candidate);
		});

		return () => {
			console.info("[WebRTC] Cleanup socket listeners");
			socket?.off("file:offer");
			socket?.off("file:answer");
			socket?.off("file:candidate");
		};
	}, [createPeerConnection, socket]);

	const onReady = async (roomId: string) => {
		console.info("[WebRTC] Ready, creating offer:", roomId);

		setRoomId(roomId);
		const pc = createPeerConnection(roomId);

		const channel = pc.createDataChannel("file");
		channel.onopen = () => {
			console.info("[WebRTC] DataChannel open, ready for transfer");
		};
		setupDataChannel(channel);

		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);

		socket?.emit("file:offer", { roomId, sdp: offer });
	};

	const sendSignal = (payload: SignalPayload) => {
		channelRef.current?.send(JSON.stringify(payload));
	};

	const sendFile = async (file: File) => {
		if (!channelRef.current) {
			console.warn("[WebRTC] No DataChannel – cannot send file");
			return;
		}

		const payload: SignalPayload = {
			type: "meta",
			data: {
				id: `file_${nanoid()}`,
				status: "sending",
				progress: 0,
				meta: {
					name: file.name,
					size: file.size,
					mime: file.type,
				},
			},
		};
		const controller = new AbortController();
		abortControllers.current.set(payload.data.id, controller);

		setSentFiles((prev) => [...prev, { ...payload.data, file }]);
		sendSignal(payload);

		console.info(
			`[WebRTC] Sending file ${payload.data.id}:`,
			payload.data.meta.name,
		);

		let offset = 0;
		try {
			while (offset < file.size) {
				if (controller.signal.aborted) {
					throw new DOMException("Canceled", "AbortError");
				}
				const chunk = await file
					.slice(offset, offset + CHUNK_SIZE)
					.arrayBuffer();
				channelRef.current.send(chunk);

				offset += chunk.byteLength;
				const progress = Math.round((offset / file.size) * 100);
				modifyFileStatus(payload.data.id, "sent", { progress });

				// Throttle if buffered amount is too high
				while (channelRef.current.bufferedAmount > 1_000_000) {
					await new Promise((r) => setTimeout(r, 10));
				}
			}

			sendSignal({ type: "completed", id: payload.data.id });
			modifyFileStatus(payload.data.id, "sent", {
				status: "completed",
				progress: 100,
			});
			console.info(`[WebRTC] File ${payload.data.id} sent completed`);
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				console.info(`[WebRTC] File ${payload.data.id} sending canceled`);
				return;
			}
			console.log("[WebRTC] Error sending file:", error);
			modifyFileStatus(payload.data.id, "sent", { status: "failed" });
			// TODO: handle other errors
		} finally {
			abortControllers.current.delete(payload.data.id);
		}
	};

	const cancelSendFile = (id: string, by: "sender" | "receiver") => {
		if (by === "sender") {
			const controller = abortControllers.current.get(id);
			if (controller) {
				controller.abort();
				modifyFileStatus(id, "sent", { status: "canceled" });
				sendSignal({ type: "canceled", id, by });
			}
		} else if (by === "receiver" && incomingData.current.data?.id === id) {
			sendSignal({ type: "canceled", id, by: "receiver" });
			setReceivedFiles((prev) => prev.filter((f) => f.id !== id));
			incomingData.current = { chunks: [], data: null };
		}
	};

	const cleanup = () => {
		console.info("[WebRTC] Cleanup connection");

		pcRef.current?.close();
		channelRef.current?.close();

		pcRef.current = null;
		channelRef.current = null;
		abortControllers.current.clear();
		incomingData.current = { chunks: [], data: null };

		setSentFiles([]);
		setReceivedFiles([]);
		setRoomId(null);
		setConnected(false);
	};

	return {
		sentFiles,
		receivedFiles,
		roomId,
		connected,
		onReady,
		cleanup,
		sendFile,
		cancelSendFile,
		setSentFiles,
		setReceivedFiles,
	};
};
