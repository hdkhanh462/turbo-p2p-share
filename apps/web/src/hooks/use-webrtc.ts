import { nanoid } from "nanoid";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import type { SocketTyped } from "@/hooks/use-socket";
import type { FileMeta } from "@/types/webrtc";

const CHUNK_SIZE = 16 * 1024; // 16KB

export type SignalPayload =
	| {
			type: "meta";
			meta: FileMeta;
	  }
	| {
			type: "canceled";
			id: string;
	  }
	| {
			type: "completed";
			id: string;
	  };

export type TransferFile = {
	id: string;
	file?: File;
	progress: number;
	direction: "sent" | "received";
	status: "sending" | "receiving" | "completed" | "failed";
};

export type UseWebRTCRetun = {
	connected: boolean;
	roomId: string | null;
	sentFiles: TransferFile[];
	receivedFiles: TransferFile[];
	cleanup: () => void;
	onReady: (roomId: string) => Promise<void>;
	sendFile: (file: File) => Promise<void>;
	setSentFiles: Dispatch<SetStateAction<TransferFile[]>>;
	setReceivedFiles: Dispatch<SetStateAction<TransferFile[]>>;
};

type Props = {
	socket: SocketTyped | null;
};

export const useWebRTC = ({ socket }: Props): UseWebRTCRetun => {
	const pcRef = useRef<RTCPeerConnection | null>(null);
	const channelRef = useRef<RTCDataChannel | null>(null);

	const incomingMeta = useRef<FileMeta | null>(null);
	const incomingChunks = useRef<ArrayBuffer[]>([]);

	const [roomId, setRoomId] = useState<string | null>(null);
	const [connected, setConnected] = useState(false);
	const [sentFiles, setSentFiles] = useState<TransferFile[]>([]);
	const [receivedFiles, setReceivedFiles] = useState<TransferFile[]>([]);

	const setupDataChannel = useCallback(
		(channel: RTCDataChannel) => {
			console.info("[WebRTC] Offer received:", roomId);

			channel.binaryType = "arraybuffer";
			channelRef.current = channel;

			channel.onmessage = (e) => {
				if (typeof e.data === "string") {
					const msg: SignalPayload = JSON.parse(e.data);
					console.debug("[WebRTC] Signal received:", msg.type);

					if (msg.type === "meta") {
						incomingMeta.current = msg.meta;
						incomingChunks.current = [];

						const receivedFile: TransferFile = {
							id: msg.meta.id,
							direction: "received",
							status: "receiving",
							progress: 0,
						};
						setReceivedFiles((prev) => [...prev, receivedFile]);

						return;
					}

					// End of transfer (completed or canceled)
					if (
						incomingMeta.current &&
						(msg.type === "canceled" || msg.type === "completed")
					) {
						console.info(`[WebRTC] Transfer ${msg.id} finished:`, msg.type);
						const meta = incomingMeta.current;

						setReceivedFiles((prev) =>
							prev.map((f) => (f.id === meta.id ? { ...f, progress: 0 } : f)),
						);

						if (msg.type === "completed") {
							console.info(
								`[WebRTC] Transfer ${incomingMeta.current.id} completed:`,
								incomingMeta.current.name,
							);
							const file = new File(
								incomingChunks.current,
								incomingMeta.current.name,
								{ type: incomingMeta.current.mime },
							);

							setReceivedFiles((prev) =>
								prev.map((f) =>
									f.id === meta.id
										? { ...f, status: "completed", progress: 100, file }
										: f,
								),
							);
						}

						// Reset buffers
						incomingChunks.current = [];
						incomingMeta.current = null;
					}
				} else {
					// ---- Binary chunks
					incomingChunks.current.push(e.data);
					const receivedSize = incomingChunks.current.reduce(
						(acc, c) => acc + c.byteLength,
						0,
					);
					if (!incomingMeta.current) return;
					const meta = incomingMeta.current;
					const progress = Math.floor((receivedSize / meta.size) * 100);

					setReceivedFiles((prev) =>
						prev.map((f) => (f.id === meta.id ? { ...f, progress } : f)),
					);
				}
			};
		},
		[roomId],
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

	const sendSignal = <T extends SignalPayload>(payload: T) => {
		channelRef.current?.send(JSON.stringify(payload));
	};

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

	const sendFile = async (file: File) => {
		if (!channelRef.current) {
			console.warn("[WebRTC] No DataChannel – cannot send file");
			return;
		}

		const payload: SignalPayload = {
			type: "meta",
			meta: {
				id: `file_${nanoid(10)}`,
				name: file.name,
				size: file.size,
				mime: file.type,
			},
		};
		const sentFile: TransferFile = {
			id: payload.meta.id,
			direction: "sent",
			status: "sending",
			progress: 0,
			file,
		};

		setSentFiles((prev) => [...prev, sentFile]);
		sendSignal(payload);

		console.info(
			`[WebRTC] Sending file ${payload.meta.id}:`,
			payload.meta.name,
		);

		let offset = 0;
		while (offset < file.size) {
			const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
			channelRef.current.send(chunk);

			offset += chunk.byteLength;
			const progress = Math.round((offset / file.size) * 100);
			setSentFiles((prev) =>
				prev.map((f) => (f.id === sentFile.id ? { ...f, progress } : f)),
			);

			while (channelRef.current.bufferedAmount > 1_000_000) {
				await new Promise((r) => setTimeout(r, 10));
			}
		}

		setSentFiles((prev) =>
			prev.map((f) =>
				f.id === sentFile.id ? { ...f, status: "completed", progress: 100 } : f,
			),
		);
		sendSignal({ type: "completed", id: payload.meta.id });
		console.info(`[WebRTC] File ${payload.meta.id} sent completed`);
	};

	const cleanup = () => {
		console.info("[WebRTC] Cleanup connection");

		pcRef.current?.close();
		channelRef.current?.close();

		pcRef.current = null;
		channelRef.current = null;
		incomingMeta.current = null;
		incomingChunks.current = [];

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
		setSentFiles,
		setReceivedFiles,
	};
};
