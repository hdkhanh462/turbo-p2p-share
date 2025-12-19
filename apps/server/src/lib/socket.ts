import type { Server as HttpServer } from "node:http";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "@turbo-p2p-share/shared/types/socket";
import { Server } from "socket.io";

interface InterServerEvents {
	ping: () => void;
}

interface SocketData {
	deviceName: string;
}

export function setupSocket(server: HttpServer) {
	const io = new Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>(server, {
		cors: { origin: "*" },
	});

	io.on("connection", (socket) => {
		console.log("Socket connected:", socket.id);

		socket.on("register", ({ deviceName }) => {
			socket.data.deviceName = deviceName;

			socket.broadcast.emit("peer-joined", { id: socket.id, deviceName });
		});

		socket.on("disconnect", () => {
			console.log("Socket disconnected:", socket.id);
			socket.broadcast.emit("peer-left", { id: socket.id });
		});
	});
}
