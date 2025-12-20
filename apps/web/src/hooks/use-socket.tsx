import {
	type ClientToServerHandlers,
	type ServerToClientHandlers,
	SocketEvent,
} from "@turbo-p2p-share/shared/types/socket";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { io, type Socket } from "socket.io-client";

interface SocketContextType {
	socket: Socket | null;
	isConnected: boolean;
	joinRoom: (roomId: string) => void;
	leaveRoom: (roomId: string) => void;
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
	const socketRef = useRef<Socket<
		ServerToClientHandlers,
		ClientToServerHandlers
	> | null>(null);
	const [isConnected, setIsConnected] = useState(false);

	useEffect(() => {
		const socket = io(import.meta.env.VITE_SOCKET_URL, {
			transports: ["websocket"],
		});

		socketRef.current = socket;

		socket.on("connect", () => setIsConnected(true));
		socket.on("disconnect", () => setIsConnected(false));

		socket.on(SocketEvent.ROOM_JOINED, ({ roomId, memberId }) => {
			console.log(`Member ${memberId} joined room: ${roomId}`);
		});
		socket.on(SocketEvent.ROOM_LEFT, ({ roomId, memberId }) => {
			console.log(`Member ${memberId} left room: ${roomId}`);
		});
		socket.on(SocketEvent.ROOM_FULL, () => {
			console.log("Room is full");
		});
		socket.on(SocketEvent.ROOM_MESSAGE, ({ roomId, message, fromMemberId }) => {
			console.log(`Room ${roomId}: Member ${fromMemberId} said: ${message}`);
		});

		return () => {
			socket.disconnect();
			socketRef.current = null;
		};
	}, []);

	const joinRoom = useCallback((roomId: string) => {
		socketRef.current?.emit(SocketEvent.JOIN_ROOM, { roomId });
	}, []);

	const leaveRoom = useCallback((roomId: string) => {
		socketRef.current?.emit(SocketEvent.LEAVE_ROOM, { roomId });
	}, []);

	return (
		<SocketContext.Provider
			value={{
				socket: socketRef.current,
				isConnected,
				joinRoom,
				leaveRoom,
			}}
		>
			{children}
		</SocketContext.Provider>
	);
};
