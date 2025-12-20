import type { ServerToClientHandlers } from "@turbo-p2p-share/shared/types/socket";
import { useEffect } from "react";
import type { SocketTyped } from "@/hooks/use-socket";

type Props = {
	socket: SocketTyped | null;
	onCandidate: ServerToClientHandlers["file:candidate"];
	onOffered: ServerToClientHandlers["file:offer"];
	onAnswered: ServerToClientHandlers["file:answer"];
};

export const useFileSocket = ({
	socket,
	onCandidate,
	onOffered,
	onAnswered,
}: Props) => {
	useEffect(() => {
		socket?.on("file:candidate", onCandidate);
		socket?.on("file:offer", onOffered);
		socket?.on("file:answer", onAnswered);

		return () => {
			socket?.off("file:candidate", onCandidate);
			socket?.off("file:offer", onOffered);
			socket?.off("file:answer", onAnswered);
		};
	}, [socket, onOffered, onAnswered, onCandidate]);
};
