import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import type { SocketTyped } from "@/hooks/use-socket";
import { useUploadQueue } from "@/hooks/use-upload-queue";
import { useWebRtcReceiver } from "@/hooks/use-webrtc-receiver";
import { useWebRtcSender } from "@/hooks/use-webrtc-sender";

export const useP2PSharing = (socketRef: RefObject<SocketTyped | null>) => {
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
					socketRef.current?.emit("file:candidate", {
						roomId,
						candidate: e.candidate,
					});
				}
			};

			pc.onconnectionstatechange = () => setConnectionState(pc.connectionState);

			peerRef.current = pc;
			return pc;
		},
		[socketRef],
	);

	const cleanup = () => {
		peerRef.current?.close();
		peerRef.current = null;
	};
	//#endregion

	useEffect(() => {
		socketRef.current?.on("file:offer", async ({ roomId, sdp }) => {
			const pc = peerRef.current || createPeerConnection(roomId);
			await pc.setRemoteDescription(sdp);

			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);

			socketRef.current?.emit("file:answer", { roomId, sdp: answer });
		});

		socketRef.current?.on("file:answer", async ({ sdp }) => {
			await peerRef.current?.setRemoteDescription(sdp);
		});

		socketRef.current?.on("file:candidate", async ({ candidate }) => {
			await peerRef.current?.addIceCandidate(candidate);
		});

		return () => {
			socketRef.current?.off("file:offer");
			socketRef.current?.off("file:answer");
			socketRef.current?.off("file:candidate");
		};
	}, [socketRef, createPeerConnection]);

	const connect = async (roomId: string) => {
		const pc = peerRef.current || createPeerConnection(roomId);

		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);

		socketRef.current?.emit("file:offer", { roomId, sdp: offer });
	};

	return {
		connect,
		cleanup,
		connectionState,
		senderItems: uploadQueue.items,
		receiverItems: receiver.items,
		addFiles: uploadQueue.addFiles,
		pauseAll: uploadQueue.pause,
		resumeAll: uploadQueue.resume,
	};
};
