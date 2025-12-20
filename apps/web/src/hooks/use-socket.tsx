import type {
	ClientToServerHandlers,
	ServerToClientHandlers,
} from "@turbo-p2p-share/shared/types/socket";
import { nanoid } from "nanoid";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { io, type Socket } from "socket.io-client";

export type SocketTyped = Socket<
	ServerToClientHandlers,
	ClientToServerHandlers
>;

interface SocketContextType {
	socket: SocketTyped | null;
	isConnected: boolean;
	randomId: string;
	createRoom: ClientToServerHandlers["room:create"];
	joinRoom: ClientToServerHandlers["room:join"];
	requestJoin: ClientToServerHandlers["room:request"];
	acceptJoin: ClientToServerHandlers["room:accept"];
	rejectJoin: ClientToServerHandlers["room:reject"];
	terminateRoom: ClientToServerHandlers["room:terminate"];
	offer: ClientToServerHandlers["file:offer"];
	answer: ClientToServerHandlers["file:answer"];
	candidate: ClientToServerHandlers["file:candidate"];
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
	const ctx = useContext(SocketContext);
	if (!ctx) throw new Error("useSocket must be used within SocketProvider");
	return ctx;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const socketRef = useRef<SocketTyped | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const randomId = useMemo(() => `room_${nanoid(10)}`, []);

	useEffect(() => {
		const socket = io(import.meta.env.VITE_SERVER_URL, {
			transports: ["websocket"],
		}) as SocketTyped;

		socketRef.current = socket;

		socket.on("connect", () => setIsConnected(true));
		socket.on("disconnect", () => setIsConnected(false));

		return () => {
			socket.disconnect();
			socketRef.current = null;
		};
	}, []);

	//#region Client to Server Handlers
	const createRoom = useCallback<ClientToServerHandlers["room:create"]>(
		(payload) => {
			socketRef.current?.emit("room:create", payload);
		},
		[],
	);

	const joinRoom = useCallback<ClientToServerHandlers["room:join"]>(
		(payload) => {
			socketRef.current?.emit("room:join", payload);
		},
		[],
	);

	const requestJoin = useCallback<ClientToServerHandlers["room:request"]>(
		(payload) => {
			socketRef.current?.emit("room:request", payload);
		},
		[],
	);

	const acceptJoin = useCallback<ClientToServerHandlers["room:accept"]>(
		(payload) => {
			socketRef.current?.emit("room:accept", payload);
		},
		[],
	);

	const rejectJoin = useCallback<ClientToServerHandlers["room:reject"]>(
		(payload) => {
			socketRef.current?.emit("room:reject", payload);
		},
		[],
	);

	const terminateRoom = useCallback<ClientToServerHandlers["room:terminate"]>(
		(payload) => {
			socketRef.current?.emit("room:terminate", payload);
		},
		[],
	);

	const candidate = useCallback<ClientToServerHandlers["file:candidate"]>(
		(payload) => {
			socketRef.current?.emit("file:candidate", payload);
		},
		[],
	);

	const offer = useCallback<ClientToServerHandlers["file:offer"]>((payload) => {
		socketRef.current?.emit("file:offer", payload);
	}, []);

	const answer = useCallback<ClientToServerHandlers["file:answer"]>(
		(payload) => {
			socketRef.current?.emit("file:answer", payload);
		},
		[],
	);
	//#endregion

	return (
		<SocketContext.Provider
			value={{
				socket: socketRef.current,
				isConnected,
				randomId,
				createRoom,
				joinRoom,
				requestJoin,
				acceptJoin,
				rejectJoin,
				terminateRoom,
				candidate,
				offer,
				answer,
			}}
		>
			{children}
		</SocketContext.Provider>
	);
};
