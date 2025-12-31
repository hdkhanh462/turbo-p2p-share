import type {
	ClientInfo,
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
	connecting: boolean;
	myRoomId: string;
	networkClients: ClientInfo[];
	setConnecting: React.Dispatch<React.SetStateAction<boolean>>;
	networkRequest(clientId: ClientInfo["id"]): void;
	cancelRequest(clientId: ClientInfo["id"]): void;
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
	const [connecting, setConnecting] = useState(false);
	const [networkClients, setNetworkClients] = useState<ClientInfo[]>([]);

	const [myRoomId] = useLocalStorage("my-room-id", () =>
		randomText({ prefix: "room_" }),
	);

	const handelError = useCallback<ServerToClientHandlers["error"]>(
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

	const handleNetworkConnect: ServerToClientHandlers["network:connect"] =
		useCallback(({ clients }) => {
			console.log("[Network] Connected:", clients);
			setNetworkClients(clients);
		}, []);

	const handleNetworkJoin: ServerToClientHandlers["network:join"] = useCallback(
		({ client }) => {
			console.log("[Network] Joined:", client);
			setNetworkClients((prev) => [...prev, client]);
		},
		[],
	);

	const handleNetworkLeave: ServerToClientHandlers["network:leave"] =
		useCallback(({ clientId }) => {
			console.log("[Network] Left:", clientId);
			setNetworkClients((prev) =>
				prev.filter((client) => client.id !== clientId),
			);
		}, []);

	const handleNetworkRequestCancel: ServerToClientHandlers["network:request-cancel"] =
		useCallback(() => {
			setConnecting(false);
		}, []);

	useEffect(() => {
		const socket = io(import.meta.env.VITE_SERVER_URL, {
			transports: ["websocket"],
			secure: false,
		});

		socketRef.current = socket;

		socket.on("connect", () => setConnected(true));
		socket.on("disconnect", () => setConnected(false));
		socket.on("error", handelError);

		socket.on("network:connect", handleNetworkConnect);
		socket.on("network:join", handleNetworkJoin);
		socket.on("network:leave", handleNetworkLeave);
		socket.on("network:request-cancel", handleNetworkRequestCancel);

		return () => {
			socket.disconnect();
			socketRef.current = null;
		};
	}, [
		handelError,
		handleNetworkConnect,
		handleNetworkJoin,
		handleNetworkLeave,
		handleNetworkRequestCancel,
	]);

	const networkRequest = (clientId: ClientInfo["id"]) => {
		socketRef.current?.emit("network:request", { clientId });
		setConnecting(true);
	};

	const cancelRequest = (clientId: string) => {
		socketRef.current?.emit("network:request-cancel", { clientId });
		setConnecting(false);
	};

	return (
		<SocketContext.Provider
			value={{
				socket: socketRef.current,
				connected,
				connecting,
				myRoomId,
				networkClients,
				setConnecting,
				networkRequest,
				cancelRequest,
			}}
		>
			{children}
		</SocketContext.Provider>
	);
};
