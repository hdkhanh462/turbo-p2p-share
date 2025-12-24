import type { ServerToClientHandlers } from "@turbo-p2p-share/shared/types/socket";
import { useCallback, useEffect, useState } from "react";

import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { SocketTyped } from "@/hooks/use-socket";

type RoomOptions = {
	onRoomCreated?: ServerToClientHandlers["room:create"];
	onRoomJoined?: ServerToClientHandlers["room:join"];
	onRoomRequested?: (
		payload: Parameters<ServerToClientHandlers["room:request"]>[0],
		accept: boolean,
	) => void;
	onRoomAccepted?: ServerToClientHandlers["room:accept"];
	onRoomRejected?: ServerToClientHandlers["room:reject"];
	onRoomTerminated?: ServerToClientHandlers["room:terminate"];
};

export const useRoomSocket = (
	socket: SocketTyped | null,
	options?: RoomOptions,
) => {
	const [connecting, setConnecting] = useState(false);
	const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

	const { alert } = useAlertDialog();

	//#region HANDLERS
	const handleRoomCreated: ServerToClientHandlers["room:create"] = useCallback(
		(payload) => {
			options?.onRoomCreated?.(payload);
		},
		[options],
	);

	const handleRoomJoined: ServerToClientHandlers["room:join"] = useCallback(
		(payload) => {
			options?.onRoomJoined?.(payload);
		},
		[options],
	);

	const handleRoomRequested: ServerToClientHandlers["room:request"] =
		useCallback(
			async (payload) => {
				const accept = await alert({
					title: "Join Request",
					description: `User ${payload.userId} wants to join your room.`,
					cancel: { label: "Reject", props: { variant: "destructive" } },
					action: { label: "Accept" },
				});
				if (!accept) {
					socket?.emit("room:reject", payload);
					options?.onRoomRequested?.(payload, accept);
					return;
				}

				options?.onRoomRequested?.(payload, accept);

				socket?.emit("room:accept", { roomId: payload.roomId });
			},
			[socket, options, alert],
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
			setConnecting(false);
			setCurrentRoomId(null);
			options?.onRoomTerminated?.();
		}, [options]);
	//#endregion

	useEffect(() => {
		socket?.on("room:create", handleRoomCreated);
		socket?.on("room:join", handleRoomJoined);
		socket?.on("room:request", handleRoomRequested);
		socket?.on("room:accept", handleAccepted);
		socket?.on("room:reject", handleRejected);
		socket?.on("room:terminate", handleTerminated);

		return () => {
			socket?.off("room:create", handleRoomCreated);
			socket?.off("room:join", handleRoomJoined);
			socket?.off("room:request", handleRoomRequested);
			socket?.off("room:accept", handleAccepted);
			socket?.off("room:reject", handleRejected);
			socket?.off("room:terminate", handleTerminated);
		};
	}, [
		socket,
		handleRoomCreated,
		handleRoomJoined,
		handleRoomRequested,
		handleAccepted,
		handleRejected,
		handleTerminated,
	]);

	//#region PUBLIC API
	const request = (roomId: string) => {
		socket?.emit("room:join", { roomId });

		if (!socket?.id) return;
		socket?.emit("room:request", {
			userId: socket.id,
			roomId,
		});
		setConnecting(true);
	};

	const terminate = () => {
		if (currentRoomId) {
			socket?.emit("room:terminate", currentRoomId);
		}
	};
	//#endregion

	return { connecting, currentRoomId, request, terminate };
};
