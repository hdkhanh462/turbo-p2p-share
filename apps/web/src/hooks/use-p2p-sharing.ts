import { useCallback, useEffect, useState } from "react";
import type { SocketTyped } from "@/hooks/use-socket";
import { useUploadQueue } from "@/hooks/use-upload-queue";
import { useWebRtcReceiver } from "@/hooks/use-webrtc-receiver";
import { useWebRtcSender } from "@/hooks/use-webrtc-sender";

export const useP2PSharing = (socket: SocketTyped | null) => {
	const [peer, setPeer] = useState<RTCPeerConnection | null>(null);

	const sender = useWebRtcSender(peer);
	const receiver = useWebRtcReceiver(peer);
	const uploadQueue = useUploadQueue(sender);

	const [connectionState, setConnectionState] =
		useState<RTCPeerConnectionState>("new");

	//#region HELPERS
	const createPeerConnection = useCallback(
		(roomId: string) => {
			const pc = new RTCPeerConnection({
				iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
			});

			pc.onicecandidate = (e) => {
				if (e.candidate) {
					socket?.emit("file:candidate", {
						roomId,
						candidate: e.candidate,
					});
				}
			};

			pc.onconnectionstatechange = () => {
				console.log("[P2P] Connection state changed:", pc.connectionState);
				setConnectionState(pc.connectionState);
			};

			pc.oniceconnectionstatechange = () =>
				console.log(
					"[P2P] ICE connection state changed:",
					pc.iceConnectionState,
				);

			pc.onicegatheringstatechange = () =>
				console.log("[P2P] ICE gathering state changed:", pc.iceGatheringState);

			setPeer(pc);
			return pc;
		},
		[socket],
	);

	const cleanup = () => {
		sender.cleanup();
		uploadQueue.cleanup();
		peer?.close();
		setPeer(null);
	};
	//#endregion

	useEffect(() => {
		socket?.on("file:offer", async ({ roomId, sdp }) => {
			console.log("[P2P] Offer received:", { roomId, sdp });

			const pc = peer || createPeerConnection(roomId);
			await pc.setRemoteDescription(sdp);

			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);

			socket?.emit("file:answer", { roomId, sdp: answer });
		});

		socket?.on("file:answer", async ({ sdp }) => {
			console.log("[P2P] Answer received:", { peer, sdp });

			await peer?.setRemoteDescription(sdp);
		});

		socket?.on("file:candidate", async ({ candidate }) => {
			await peer?.addIceCandidate(candidate);
		});

		return () => {
			socket?.off("file:offer");
			socket?.off("file:answer");
			socket?.off("file:candidate");
		};
	}, [socket, createPeerConnection, peer]);

	const connect = async (roomId: string) => {
		const pc = peer || createPeerConnection(roomId);

		const channel = pc.createDataChannel(roomId);
		channel.onopen = () => {
			console.info("[P2P] DataChannel open:", channel);
		};

		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);

		socket?.emit("file:offer", { roomId, sdp: offer });
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
