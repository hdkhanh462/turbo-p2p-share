import type { Server as HttpServer } from "node:http";
import type {
	ClientToServerHandlers,
	ServerToClientHandlers,
} from "@turbo-p2p-share/shared/types/socket";
import { Server } from "socket.io";

interface InterServerEvents {
	ping: () => void;
}

type SocketData = {
	userId: string;
};

export function setupSocket(server: HttpServer) {
	const io = new Server<
		ClientToServerHandlers,
		ServerToClientHandlers,
		InterServerEvents,
		SocketData
	>(server, {
		cors: { origin: "*" },
	});

	io.on("connection", (socket) => {
		console.log("Socket connected:", socket.id);

		socket.on("room:create", ({ roomId }) => {
			socket.join(roomId);
			socket.emit("room:create", { roomId });
		});

		socket.on("room:join", ({ roomId }) => {
			socket.join(roomId);
			socket.emit("room:join", { roomId });
		});

		socket.on("room:request", (payload) => {
			socket.to(payload.roomId).emit("room:request", payload);
		});

		socket.on("room:accept", (payload) => {
			io.to(payload.roomId).emit("room:accept", payload);
		});

		socket.on("room:reject", ({ roomId }) => {
			// TODO: If exist => leave
			socket.to(roomId).emit("room:reject", { userId: socket.id });
		});

		socket.on("room:terminate", (roomId) => {
			io.to(roomId).emit("room:terminate");
		});

		socket.on("file:offer", (payload) => {
			socket.to(payload.roomId).emit("file:offer", payload);
		});

		socket.on("file:answer", ({ roomId, sdp }) => {
			socket.to(roomId).emit("file:answer", { sdp });
		});

		socket.on("file:candidate", ({ roomId, candidate }) => {
			socket.to(roomId).emit("file:candidate", { candidate });
		});

		socket.on("disconnecting", () => {
			console.log("Socket disconnecting:", socket.id);
		});

		socket.on("disconnect", () => {
			console.log("Socket disconnected:", socket.id);
		});
	});
}
