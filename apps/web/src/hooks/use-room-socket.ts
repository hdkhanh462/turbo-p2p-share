import type { ServerToClientHandlers } from "@turbo-p2p-share/shared/types/socket";
import { useCallback, useEffect, useState } from "react";

import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { SocketTyped } from "@/hooks/use-socket";

type Props = {
	socket: SocketTyped | null;
	onRoomCreated?: ServerToClientHandlers["room:create"];
	onRoomJoined?: ServerToClientHandlers["room:join"];
	onRoomRequested?: ServerToClientHandlers["room:request"];
	onRoomAccepted?: ServerToClientHandlers["room:accept"];
	onRoomRejected?: ServerToClientHandlers["room:reject"];
	onRoomTerminated?: ServerToClientHandlers["room:terminate"];
};

export const useRoomSocket = ({
	socket,
	onRoomCreated,
	onRoomJoined,
	onRoomRequested,
	onRoomAccepted,
	onRoomRejected,
	onRoomTerminated,
}: Props) => {
	const [connecting, setConnecting] = useState(false);
	const [currentRoomId, setCurrentRoomId] = useState<string>();

	const { alert } = useAlertDialog();

	const handleRoomRequested: ServerToClientHandlers["room:request"] =
		useCallback(
			async ({ roomId, userId }) => {
				const accept = await alert({
					title: "Join Request",
					description: `User ${userId} wants to join your room.`,
					cancel: { label: "Reject", props: { variant: "destructive" } },
					action: { label: "Accept" },
				});
				if (!accept) {
					socket?.emit("room:reject", { roomId, userId });
					return;
				}

				onRoomRequested?.({ roomId, userId });

				socket?.emit("room:accept", { roomId });
			},
			[socket, alert, onRoomRequested],
		);

	const handleAccepted: ServerToClientHandlers["room:accept"] = useCallback(
		({ roomId }: { roomId: string }) => {
			setConnecting(false);
			setCurrentRoomId(roomId);
			onRoomAccepted?.({ roomId });
		},
		[onRoomAccepted],
	);

	const handleRejected: ServerToClientHandlers["room:reject"] = useCallback(
		(payload) => {
			setConnecting(false);
			onRoomRejected?.(payload);
		},
		[onRoomRejected],
	);

	const handleTerminated: ServerToClientHandlers["room:terminate"] =
		useCallback(() => {
			setConnecting(false);
			setCurrentRoomId(undefined);
			onRoomTerminated?.();
		}, [onRoomTerminated]);

	useEffect(() => {
		socket?.on("room:create", (payload) => onRoomCreated?.(payload));
		socket?.on("room:join", (payload) => onRoomJoined?.(payload));
		socket?.on("room:request", handleRoomRequested);
		socket?.on("room:accept", handleAccepted);
		socket?.on("room:reject", handleRejected);
		socket?.on("room:terminate", handleTerminated);

		return () => {
			socket?.off("room:create", onRoomCreated);
			socket?.off("room:join", onRoomJoined);
			socket?.off("room:request", handleRoomRequested);
			socket?.off("room:accept", handleAccepted);
			socket?.off("room:reject", handleRejected);
			socket?.off("room:terminate", handleTerminated);
		};
	}, [
		socket,
		handleRoomRequested,
		handleAccepted,
		handleRejected,
		handleTerminated,
		onRoomCreated,
		onRoomJoined,
	]);

	return { connecting, currentRoomId };
};
