import { useRef, useState } from "react";

const CHUNK_SIZE = 16 * 1024; // 16KB

export type RTCDataChannelStatus =
	| "idle"
	| "connecting"
	| "connected"
	| "sending"
	| "done";

export const useWebRTC = () => {
	const pcRef = useRef<RTCPeerConnection | null>(null);
	const dataChannelRef = useRef<RTCDataChannel | null>(null);
	const receivedBuffersRef = useRef<ArrayBuffer[]>([]);
	const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
	const receivedMetaRef = useRef<{
		name: string;
		mime: string;
	} | null>(null);
	const [file, setFile] = useState<File | null>(null);
	const [progress, setProgress] = useState(0);
	const [status, setStatus] = useState<RTCDataChannelStatus>("idle");

	const initReceiver = () => {
		cleanup();

		const pc = new RTCPeerConnection();
		pcRef.current = pc;
		setStatus("connecting");

		pc.ondatachannel = (event) => {
			const channel = event.channel;
			channel.binaryType = "arraybuffer";

			channel.onmessage = (e) => {
				if (typeof e.data === "string") {
					const msg = JSON.parse(e.data);

					if (msg.type === "meta") {
						receivedMetaRef.current = {
							name: msg.name,
							mime: msg.mime || "application/octet-stream",
						};
						return;
					}

					if (msg.type === "done" && receivedMetaRef.current) {
						console.log("DONE:", receivedMetaRef.current);
						const blob = new Blob(receivedBuffersRef.current, {
							type: receivedMetaRef.current.mime,
						});

						const url = URL.createObjectURL(blob);

						const a = document.createElement("a");
						a.href = url;
						a.download = receivedMetaRef.current.name;
						a.click();

						URL.revokeObjectURL(url);

						receivedBuffersRef.current = [];
						receivedMetaRef.current = null;
						setStatus("done");
					}
				} else {
					receivedBuffersRef.current.push(e.data);
				}
			};

			setStatus("connected");
		};

		return pc;
	};

	const initSender = () => {
		const pc = new RTCPeerConnection({ iceServers: [] });
		pcRef.current = pc;

		const dc = pc.createDataChannel("file");
		dataChannelRef.current = dc;
		dc.binaryType = "arraybuffer";

		dc.onopen = () => setStatus("connected");
		dc.onclose = () => setStatus("idle");

		return pc;
	};

	const sendFile = async () => {
		if (!file || !dataChannelRef.current) return;

		setStatus("sending");
		setProgress(0);

		dataChannelRef.current.send(
			JSON.stringify({
				type: "meta",
				name: file.name,
				mime: file.type,
				size: file.size,
			}),
		);

		let offset = 0;

		while (offset < file.size) {
			const slice = file.slice(offset, offset + CHUNK_SIZE);
			const buffer = await slice.arrayBuffer();
			dataChannelRef.current.send(buffer);

			offset += CHUNK_SIZE;
			setProgress(Math.round((offset / file.size) * 100));

			while (dataChannelRef.current.bufferedAmount > 1_000_000) {
				await new Promise((r) => setTimeout(r, 10));
			}
		}

		dataChannelRef.current.send(JSON.stringify({ type: "done" }));
		setStatus("done");
	};

	const addIceCandidateSafe = async (candidate: RTCIceCandidateInit) => {
		const pc = pcRef.current;
		if (!pc) return;

		if (pc.remoteDescription) {
			await pc.addIceCandidate(candidate);
		} else {
			pendingCandidatesRef.current.push(candidate);
		}
	};

	const flushPendingCandidates = async () => {
		const pc = pcRef.current;
		if (!pc) return;

		for (const c of pendingCandidatesRef.current) {
			await pc.addIceCandidate(c);
		}
		pendingCandidatesRef.current = [];
	};

	const cleanup = () => {
		dataChannelRef.current?.close();
		pcRef.current?.close();
		dataChannelRef.current = null;
		pcRef.current = null;
		receivedBuffersRef.current = [];
		setProgress(0);
		setStatus("idle");
	};

	return {
		file,
		status,
		progress,
		pcRef,
		dataChannelRef,
		setStatus,
		initSender,
		initReceiver,
		sendFile,
		setFile,
		setProgress,
		cleanup,
		addIceCandidateSafe,
		flushPendingCandidates,
	};
};
