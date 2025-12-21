import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SocketTyped } from "@/hooks/use-socket";
import type { FileMeta, FileState } from "@/types/webrtc";
import { triggerFileDownload } from "@/utils/download";

const CHUNK_SIZE = 16 * 1024; // 16KB

export type SignalPayload =
	| {
			type: "meta";
			meta: FileMeta;
	  }
	| {
			type: "buffer";
			buffer: ArrayBuffer;
			progress: number;
	  }
	| {
			type: "completed";
	  };

type Props = {
	socket: SocketTyped | null;
};

export const useWebRTC = ({ socket }: Props) => {
	const pcRef = useRef<RTCPeerConnection | null>(null);
	const channelRef = useRef<RTCDataChannel | null>(null);

	const incomingMeta = useRef<FileMeta | null>(null);
	const incomingChunks = useRef<ArrayBuffer[]>([]);

	const [roomId, setRoomId] = useState<string | null>(null);
	const [connected, setConnected] = useState(false);
	const [incomingFile, setIncomingFile] = useState<FileState | null>(null);
	const [outgoingFile, setOutgoingFile] = useState<FileState | null>(null);

	const setupDataChannel = useCallback((channel: RTCDataChannel) => {
		channel.binaryType = "arraybuffer";
		channelRef.current = channel;

		channel.onmessage = (e) => {
			if (typeof e.data === "string") {
				const msg: SignalPayload = JSON.parse(e.data);

				if (msg.type === "meta") {
					incomingMeta.current = msg.meta;
					incomingChunks.current = [];

					setIncomingFile({
						meta: msg.meta,
						progress: 0,
						status: "downloading",
					});
					return;
				}

				if (msg.type === "completed" && incomingMeta.current) {
					setIncomingFile((prev) =>
						prev ? { ...prev, progress: 0, status: "completed" } : null,
					);

					// Cleanup
					// incomingChunks.current = [];
					// incomingMeta.current = null;
				}
			} else {
				incomingChunks.current.push(e.data);
				const receivedSize = incomingChunks.current.reduce(
					(acc, c) => acc + c.byteLength,
					0,
				);
				if (!incomingMeta.current) return;

				const progress = Math.floor(
					(receivedSize / incomingMeta.current.size) * 100,
				);

				setIncomingFile((prev) => (prev ? { ...prev, progress } : null));
			}
		};
	}, []);

	const createPeerConnection = useCallback(
		(roomId: string) => {
			const pc = new RTCPeerConnection({ iceServers: [] });

			pc.onicecandidate = (e) => {
				if (e.candidate) {
					socket?.emit("file:candidate", { roomId, candidate: e.candidate });
				}
			};

			pc.onconnectionstatechange = () => {
				setConnected(pc.connectionState === "connected");
			};

			pc.ondatachannel = (e) => {
				setupDataChannel(e.channel);
			};

			pcRef.current = pc;
			return pc;
		},
		[socket, setupDataChannel],
	);

	useEffect(() => {
		socket?.on("file:offer", async ({ roomId, sdp }) => {
			const pc = createPeerConnection(roomId);
			await pc.setRemoteDescription(sdp);

			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);

			socket.emit("file:answer", { roomId, sdp: answer });
		});

		socket?.on("file:answer", async ({ sdp }) => {
			await pcRef.current?.setRemoteDescription(sdp);
		});

		socket?.on("file:candidate", async ({ candidate }) => {
			await pcRef.current?.addIceCandidate(candidate);
		});

		return () => {
			socket?.off();
		};
	}, [createPeerConnection, socket]);

	const onReady = async (roomId: string) => {
		setRoomId(roomId);
		const pc = createPeerConnection(roomId);

		const channel = pc.createDataChannel("file");
		setupDataChannel(channel);

		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);

		socket?.emit("file:offer", { roomId, sdp: offer });
	};

	const sendFile = async (file: File) => {
		if (!channelRef.current) return;

		const payload: SignalPayload = {
			type: "meta",
			meta: {
				id: `room_${nanoid(10)}`,
				name: file.name,
				size: file.size,
				mime: file.type,
			},
		};
		channelRef.current.send(JSON.stringify(payload));
		setOutgoingFile({ meta: payload.meta, progress: 0, status: "uploading" });

		let offset = 0;
		while (offset < file.size) {
			const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
			channelRef.current.send(chunk);

			offset += chunk.byteLength;
			const progress = Math.round((offset / file.size) * 100);
			setOutgoingFile((prev) => (prev ? { ...prev, progress } : null));

			while (channelRef.current.bufferedAmount > 1_000_000) {
				await new Promise((r) => setTimeout(r, 10));
			}
		}

		channelRef.current.send(JSON.stringify({ type: "completed" }));
	};

	const downloadFile = () => {
		if (!incomingMeta.current || incomingChunks.current.length === 0) return;
		triggerFileDownload(incomingMeta.current, incomingChunks.current);
	};

	const cleanup = () => {
		pcRef.current?.close();
		pcRef.current = null;
		channelRef.current?.close();
	};

	return {
		roomId,
		connected,
		incomingFile,
		outgoingFile,
		onReady,
		cleanup,
		sendFile,
		downloadFile,
	};
};
