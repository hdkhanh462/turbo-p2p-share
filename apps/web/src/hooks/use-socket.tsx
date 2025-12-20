import {
	type ClientToServerHandlers,
	type ServerToClientHandlers,
	SocketEvent,
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

type SocketTyped = Socket<ServerToClientHandlers, ClientToServerHandlers>;

interface SocketContextType {
	socket: SocketTyped | null;
	isConnected: boolean;
	userId: string;
	createRoom: ClientToServerHandlers[SocketEvent.ROOM_PRE_CREATE];
	joinRequest: ClientToServerHandlers[SocketEvent.ROOM_JOIN_REQUEST];
	acceptJoin: ClientToServerHandlers[SocketEvent.ROOM_JOIN_ACCEPT];
	rejectJoin: ClientToServerHandlers[SocketEvent.ROOM_JOIN_REJECT];
	terminateRoom: ClientToServerHandlers[SocketEvent.ROOM_TERMINATE];
	sendMessage: ClientToServerHandlers[SocketEvent.ROOM_MESSAGE];
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
	const userId = useMemo(() => nanoid(10), []);

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

	const createRoom = useCallback<
		ClientToServerHandlers[SocketEvent.ROOM_PRE_CREATE]
	>(({ userId }) => {
		socketRef.current?.emit(SocketEvent.ROOM_PRE_CREATE, { userId });
	}, []);

	const joinRequest = useCallback<
		ClientToServerHandlers[SocketEvent.ROOM_JOIN_REQUEST]
	>(({ roomId, userId }) => {
		socketRef.current?.emit(SocketEvent.ROOM_JOIN_REQUEST, { roomId, userId });
	}, []);

	const acceptJoin = useCallback<
		ClientToServerHandlers[SocketEvent.ROOM_JOIN_ACCEPT]
	>((roomId) => {
		socketRef.current?.emit(SocketEvent.ROOM_JOIN_ACCEPT, roomId);
	}, []);

	const rejectJoin = useCallback<
		ClientToServerHandlers[SocketEvent.ROOM_JOIN_REJECT]
	>((roomId) => {
		socketRef.current?.emit(SocketEvent.ROOM_JOIN_REJECT, roomId);
	}, []);

	const terminateRoom = useCallback<
		ClientToServerHandlers[SocketEvent.ROOM_TERMINATE]
	>((roomId) => {
		socketRef.current?.emit(SocketEvent.ROOM_TERMINATE, roomId);
	}, []);

	const sendMessage = useCallback<
		ClientToServerHandlers[SocketEvent.ROOM_MESSAGE]
	>(({ roomId, message }) => {
		socketRef.current?.emit(SocketEvent.ROOM_MESSAGE, {
			roomId,
			message,
		});
	}, []);

	return (
		<SocketContext.Provider
			value={{
				socket: socketRef.current,
				isConnected,
				userId,
				createRoom,
				joinRequest,
				acceptJoin,
				rejectJoin,
				terminateRoom,
				sendMessage,
			}}
		>
			{children}
		</SocketContext.Provider>
	);
};
