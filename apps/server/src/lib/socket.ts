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
	roomId: string;
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
		console.log("[Socket] Connected:", socket.id);

		socket.on("room:create", ({ roomId }) => {
			socket.data.roomId = roomId;
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

		socket.on("room:reject", ({ roomId, userId }) => {
			const targetSocket = io.sockets.sockets.get(userId);
			if (targetSocket) {
				targetSocket.leave(roomId);
			}
			socket.to(userId).emit("room:reject", { roomId, userId: socket.id });
		});

		socket.on("room:terminate", (roomId) => {
			io.to(roomId).emit("room:terminate");
			if (roomId !== socket.data.roomId) socket.leave(roomId);
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
			console.log("[Socket] Disconnecting:", socket.id);

			socket.rooms.forEach((roomId) => {
				if (roomId !== socket.id) {
					socket.to(roomId).emit("room:terminate");
				}
			});
		});

		socket.on("disconnect", () => {
			console.log("[Socket] Disconnected:", socket.id);
		});
	});
}
