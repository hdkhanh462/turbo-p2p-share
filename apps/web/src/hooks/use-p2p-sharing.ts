import { useCallback, useEffect, useRef, useState } from "react";
import type { SocketTyped } from "@/hooks/use-socket";
import { useUploadQueue } from "@/hooks/use-upload-queue";
import { useWebRtcReceiver } from "@/hooks/use-webrtc-receiver";
import { useWebRtcSender } from "@/hooks/use-webrtc-sender";

export const useP2PSharing = (socket: SocketTyped | null) => {
	const peerRef = useRef<RTCPeerConnection | null>(null);

	const sender = useWebRtcSender(peerRef);
	const receiver = useWebRtcReceiver(peerRef);
	const uploadQueue = useUploadQueue(sender);

	const [connectionState, setConnectionState] =
		useState<RTCPeerConnectionState>("new");

	//#region HELPERS
	const createPeerConnection = useCallback(
		(roomId: string) => {
			const pc = new RTCPeerConnection({ iceServers: [] });

			pc.onicecandidate = (e) => {
				if (e.candidate) {
					socket?.emit("file:candidate", { roomId, candidate: e.candidate });
				}
			};

			pc.onconnectionstatechange = () => setConnectionState(pc.connectionState);

			peerRef.current = pc;
			return pc;
		},
		[socket],
	);

	const cleanup = () => {
		peerRef.current?.close();
		peerRef.current = null;
	};
	//#endregion

	useEffect(() => {
		socket?.on("file:offer", async ({ roomId, sdp }) => {
			const pc = createPeerConnection(roomId);
			await pc.setRemoteDescription(sdp);

			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);

			socket.emit("file:answer", { roomId, sdp: answer });
		});

		socket?.on("file:answer", async ({ sdp }) => {
			await peerRef.current?.setRemoteDescription(sdp);
		});

		socket?.on("file:candidate", async ({ candidate }) => {
			await peerRef.current?.addIceCandidate(candidate);
		});

		return () => {
			socket?.off("file:offer");
			socket?.off("file:answer");
			socket?.off("file:candidate");
		};
	}, [socket, createPeerConnection]);

	return {
		cleanup,
		connectionState,
		senderItems: uploadQueue.items,
		receiverItems: receiver.items,
		addFiles: uploadQueue.addFiles,
		pauseAll: uploadQueue.pause,
		resumeAll: uploadQueue.resume,
	};
};
