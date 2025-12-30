import type { ServerToClientHandlers } from "@turbo-p2p-share/shared/types/socket";
import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/components/room-messages";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { SocketTyped } from "@/hooks/use-socket";

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
};

export const useRoomSocket = (
	socket: SocketTyped | null,
	options?: RoomOptions,
) => {
	const [connecting, setConnecting] = useState(false);
	const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);

	const { alert, close } = useAlertDialog();

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
		(payload) => {
			setMessages((prev) => [payload, ...prev]);
			options?.onRoomMessage?.(payload);
		},
		[options],
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

		return () => {
			socket?.off("room:create", handleRoomCreated);
			socket?.off("room:request", handleRoomRequested);
			socket?.off("room:request-cancel", handleRoomeRequestCancelled);
			socket?.off("room:accept", handleAccepted);
			socket?.off("room:reject", handleRejected);
			socket?.off("room:terminate", handleTerminated);
			socket?.off("room:message", handleMessage);
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

	const sendMessage = (text: string) => {
		if (currentRoomId) {
			socket?.emit("room:message", { roomId: currentRoomId, text });
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
