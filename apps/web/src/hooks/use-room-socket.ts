import type { ServerToClientHandlers } from "@turbo-p2p-share/shared/types/socket";
import { type RefObject, useCallback, useEffect, useState } from "react";

import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { SocketTyped } from "@/hooks/use-socket";

type UseRoomSocketOptions = {
	onRoomCreated?: ServerToClientHandlers["room:create"];
	onRoomJoined?: ServerToClientHandlers["room:join"];
	onRoomRequested?: ServerToClientHandlers["room:request"];
	onRoomAccepted?: ServerToClientHandlers["room:accept"];
	onRoomRejected?: ServerToClientHandlers["room:reject"];
	onRoomTerminated?: ServerToClientHandlers["room:terminate"];
};

export const useRoomSocket = (
	socketRef: RefObject<SocketTyped | null>,
	options?: UseRoomSocketOptions,
) => {
	const [connecting, setConnecting] = useState(false);
	const [currentRoomId, setCurrentRoomId] = useState<string>();

	const { alert } = useAlertDialog();

	//#region HANDLERS
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
					socketRef.current?.emit("room:reject", { roomId, userId });
					return;
				}

				options?.onRoomRequested?.({ roomId, userId });

				socketRef.current?.emit("room:accept", { roomId });
			},
			[socketRef, alert, options],
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
			setCurrentRoomId(undefined);
			options?.onRoomTerminated?.();
		}, [options]);
	//#endregion

	useEffect(() => {
		socketRef.current?.on("room:create", (payload) =>
			options?.onRoomCreated?.(payload),
		);
		socketRef.current?.on("room:join", (payload) =>
			options?.onRoomJoined?.(payload),
		);
		socketRef.current?.on("room:request", handleRoomRequested);
		socketRef.current?.on("room:accept", handleAccepted);
		socketRef.current?.on("room:reject", handleRejected);
		socketRef.current?.on("room:terminate", handleTerminated);

		return () => {
			socketRef.current?.off("room:create", options?.onRoomCreated);
			socketRef.current?.off("room:join", options?.onRoomJoined);
			socketRef.current?.off("room:request", handleRoomRequested);
			socketRef.current?.off("room:accept", handleAccepted);
			socketRef.current?.off("room:reject", handleRejected);
			socketRef.current?.off("room:terminate", handleTerminated);
		};
	}, [
		socketRef,
		options,
		handleRoomRequested,
		handleAccepted,
		handleRejected,
		handleTerminated,
	]);

	return { connecting, currentRoomId };
};
