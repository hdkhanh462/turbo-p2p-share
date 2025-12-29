import type {
	ClientToServerHandlers,
	ServerToClientHandlers,
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
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { randomText } from "@/utils/random-text";

export type SocketTyped = Socket<
	ServerToClientHandlers,
	ClientToServerHandlers
>;

interface SocketContextType {
	socket: SocketTyped | null;
	connected: boolean;
	myRoomId: string;
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

	const [connected, setConnected] = useState(false);

	const [myRoomId] = useLocalStorage("my-room-id", () =>
		randomText({ prefix: "room_" }),
	);

	const onError = useCallback<ServerToClientHandlers["error"]>(
		({ messages }) => {
			toast.error("Socket Error", {
				description: (
					<ul>
						{messages.map((msg) => (
							<li key={msg}>{msg}</li>
						))}
					</ul>
				),
			});
		},
		[],
	);

	useEffect(() => {
		const socket = io(import.meta.env.VITE_SERVER_URL, {
			transports: ["websocket"],
			secure: false,
		});

		socketRef.current = socket;

		socket.on("connect", () => setConnected(true));
		socket.on("disconnect", () => setConnected(false));
		socket.on("error", onError);

		return () => {
			socket.disconnect();
			socketRef.current = null;
		};
	}, [onError]);

	return (
		<SocketContext.Provider
			value={{
				socket: socketRef.current,
				connected,
				myRoomId,
			}}
		>
			{children}
		</SocketContext.Provider>
	);
};
