import type { ServerToClientHandlers } from "@turbo-p2p-share/shared/types/socket";
import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/components/room-messages";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useE2EEncryption } from "@/hooks/use-e2e-encryption";
import type { SocketTyped } from "@/hooks/use-socket";
import { randomText } from "@/utils/random-text";

type RoomOptions = {
	onRoomCreated?: ServerToClientHandlers["room:create"];
	onRoomRequested?: (
		payload: Parameters<ServerToClientHandlers["room:request"]>[0],
		accept: boolean,
	) => void;
	onRoomRequestCancelled?: (
		payload: Parameters<ServerToClientHandlers["room:request-cancel"]>[0],
	) => void;
	onRoomAccepted?: ServerToClientHandlers["room:accept"];
	onRoomRejected?: ServerToClientHandlers["room:reject"];
	onRoomTerminated?: ServerToClientHandlers["room:terminate"];
	onRoomMessage?: ServerToClientHandlers["room:message"];
	onRoomPublicKey?: ServerToClientHandlers["room:public-key"];
};

export const useRoomSocket = (
	socket: SocketTyped | null,
	options?: RoomOptions,
) => {
	const [connecting, setConnecting] = useState(false);
	const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);

	const { alert, close } = useAlertDialog();
	const { encryptText, decryptText } = useE2EEncryption();

	//#region HANDLERS
	const cleanup = useCallback(() => {
		setConnecting(false);
		setCurrentRoomId(null);
		setMessages([]);
		close();
	}, [close]);

	const handleRoomCreated: ServerToClientHandlers["room:create"] = useCallback(
		(payload) => {
			options?.onRoomCreated?.(payload);
		},
		[options],
	);

	const handleRoomRequested: ServerToClientHandlers["room:request"] =
		useCallback(
			async ({ roomId, userId }) => {
				if (currentRoomId) {
					socket?.emit("room:reject", {
						roomId,
						userId,
						reason: "HOST_BUSY",
					});
					return;
				}
				const accept = await alert({
					title: "Join Request",
					description: `User ${userId} wants to join your room.`,
					cancel: { label: "Reject", props: { variant: "destructive" } },
					action: { label: "Accept" },
				});
				if (!accept) {
					socket?.emit("room:reject", {
						roomId,
						userId,
						reason: "HOST_REJECTED",
					});
					options?.onRoomRequested?.({ roomId, userId }, accept);
					return;
				}

				options?.onRoomRequested?.({ roomId, userId }, accept);

				socket?.emit("room:accept", { roomId });
			},
			[socket, options, alert, currentRoomId],
		);

	const handleRoomeRequestCancelled: ServerToClientHandlers["room:request-cancel"] =
		useCallback(
			(payload) => {
				cleanup();
				options?.onRoomRequestCancelled?.(payload);
			},
			[options, cleanup],
		);

	const handleAccepted: ServerToClientHandlers["room:accept"] = useCallback(
		({ roomId }: { roomId: string }) => {
			setConnecting(false);
			setCurrentRoomId(roomId);
			options?.onRoomAccepted?.({ roomId });
		},
		[options],
	);

	const handleRejected: ServerToClientHandlers["room:reject"] = useCallback(
		(payload) => {
			setConnecting(false);
			options?.onRoomRejected?.(payload);
		},
		[options],
	);

	const handleTerminated: ServerToClientHandlers["room:terminate"] =
		useCallback(() => {
			cleanup();
			options?.onRoomTerminated?.();
		}, [options, cleanup]);

	const handleMessage: ServerToClientHandlers["room:message"] = useCallback(
		async (payload) => {
			const plainText = await decryptText(payload.encryptedMessage);

			setMessages((prev) => [
				{
					id: payload.id,
					senderId: payload.senderId,
					text: plainText,
				},
				...prev,
			]);
			options?.onRoomMessage?.(payload);
		},
		[options, decryptText],
	);

	const handleRoomPublicKey: ServerToClientHandlers["room:public-key"] =
		useCallback(
			(payload) => {
				options?.onRoomPublicKey?.(payload);
			},
			[options?.onRoomPublicKey],
		);

	//#endregion

	useEffect(() => {
		socket?.on("room:create", handleRoomCreated);
		socket?.on("room:request", handleRoomRequested);
		socket?.on("room:request-cancel", handleRoomeRequestCancelled);
		socket?.on("room:accept", handleAccepted);
		socket?.on("room:reject", handleRejected);
		socket?.on("room:terminate", handleTerminated);
		socket?.on("room:message", handleMessage);
		socket?.on("room:public-key", handleRoomPublicKey);

		return () => {
			socket?.off("room:create", handleRoomCreated);
			socket?.off("room:request", handleRoomRequested);
			socket?.off("room:request-cancel", handleRoomeRequestCancelled);
			socket?.off("room:accept", handleAccepted);
			socket?.off("room:reject", handleRejected);
			socket?.off("room:terminate", handleTerminated);
			socket?.off("room:message", handleMessage);
			socket?.off("room:public-key", handleRoomPublicKey);
		};
	}, [
		socket,
		handleRoomCreated,
		handleRoomRequested,
		handleRoomeRequestCancelled,
		handleAccepted,
		handleRejected,
		handleTerminated,
		handleMessage,
		handleRoomPublicKey,
	]);

	//#region PUBLIC API
	const request = (roomId: string) => {
		if (!socket?.id) return;
		socket?.emit("room:request", { roomId });
		setConnecting(true);
	};

	const cancelRequest = (roomId: string) => {
		if (!socket?.id) return;
		socket?.emit("room:request-cancel", { roomId });
		setConnecting(false);
	};

	const terminate = () => {
		if (currentRoomId) {
			socket?.emit("room:terminate", currentRoomId);
		}
	};

	const sendMessage = async (message: string) => {
		if (currentRoomId && socket?.id) {
			const newMessage: ChatMessage = {
				id: randomText({ prefix: "msg_", length: 12 }),
				senderId: socket.id,
				text: message,
			};
			setMessages((prev) => [newMessage, ...prev]);
			const encryptedMessage = await encryptText(message);
			socket?.emit("room:message", { roomId: currentRoomId, encryptedMessage });
		}
	};

	//#endregion

	return {
		connecting,
		currentRoomId,
		messages,
		request,
		cancelRequest,
		terminate,
		sendMessage,
	};
};
