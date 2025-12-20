import type { ServerToClientHandlers } from "@turbo-p2p-share/shared/types/socket";
import { useEffect } from "react";
import type { SocketTyped } from "@/hooks/use-socket";

type Props = {
	socket: SocketTyped | null;
	onRoomCreated: ServerToClientHandlers["room:create"];
	onRoomJoined: ServerToClientHandlers["room:join"];
	onRoomRequested: ServerToClientHandlers["room:request"];
	onRoomAccepted: ServerToClientHandlers["room:accept"];
	onRoomRejected: ServerToClientHandlers["room:reject"];
	onRoomTerminated: ServerToClientHandlers["room:terminate"];
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
	useEffect(() => {
		socket?.on("room:create", onRoomCreated);
		socket?.on("room:join", onRoomJoined);
		socket?.on("room:request", onRoomRequested);
		socket?.on("room:accept", onRoomAccepted);
		socket?.on("room:reject", onRoomRejected);
		socket?.on("room:terminate", onRoomTerminated);

		return () => {
			socket?.off("room:create", onRoomCreated);
			socket?.off("room:join", onRoomJoined);
			socket?.off("room:request", onRoomRequested);
			socket?.off("room:accept", onRoomAccepted);
			socket?.off("room:reject", onRoomRejected);
			socket?.off("room:terminate", onRoomTerminated);
		};
	}, [
		socket,
		onRoomCreated,
		onRoomJoined,
		onRoomRequested,
		onRoomAccepted,
		onRoomRejected,
		onRoomTerminated,
	]);
};
