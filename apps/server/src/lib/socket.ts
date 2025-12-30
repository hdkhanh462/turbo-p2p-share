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
			const room = io.sockets.adapter.rooms.get(roomId);
			if (room) {
				console.log("[Room] Already exists:", roomId);
				io.to(socket.id).emit("error", {
					messages: [`Room with ID "${roomId}" already exists.`],
				});
				return;
			}

			console.log("[Room] Creating:", roomId);

			socket.data.roomId = roomId;
			socket.join(roomId);
			socket.emit("room:create", { roomId });
		});

		socket.on("room:request", ({ roomId }) => {
			console.log("[Room] Requesting:", roomId);

			const room = io.sockets.adapter.rooms.get(roomId);
			const memberCount = room?.size ?? 0;

			if (memberCount >= 2) {
				console.log("[Room] Full:", roomId);

				io.to(socket.id).emit("room:reject", {
					roomId,
					reason: "ROOM_FULL",
				});
				return;
			}

			socket.join(roomId);
			socket.to(roomId).emit("room:request", { roomId, userId: socket.id });
		});

		socket.on("room:request-cancel", ({ roomId }) => {
			console.log("[Room] Request cancelled:", roomId);
			socket.leave(roomId);

			socket.to(roomId).emit("room:request-cancel", {
				roomId,
				userId: socket.id,
			});
		});

		socket.on("room:accept", (payload) => {
			console.log("[Room] Accepting:", payload);

			io.to(payload.roomId).emit("room:accept", payload);
		});

		socket.on("room:reject", ({ roomId, userId, reason }) => {
			console.log("[Room] Rejecting:", roomId);

			const targetSocket = io.sockets.sockets.get(userId);
			if (targetSocket) targetSocket.leave(roomId);

			io.to(userId).emit("room:reject", { roomId, reason });
		});

		socket.on("room:terminate", (roomId) => {
			console.log("[Room] Terminating:", roomId);

			io.to(roomId).emit("room:terminate");
			if (roomId !== socket.data.roomId) socket.leave(roomId);
			else {
				const room = io.sockets.adapter.rooms.get(roomId);
				if (room) {
					for (const memberId of room) {
						const memberSocket = io.sockets.sockets.get(memberId);
						if (memberSocket && memberId !== socket.id) {
							console.log("[Room] Removing member:", memberId);
							memberSocket.leave(roomId);
						}
					}
				}
			}
		});

		socket.on("room:message", ({ roomId, encryptedMessage }) => {
			console.log("[Room] Messaging:", roomId);
			socket.to(roomId).emit("room:message", {
				id: crypto.randomUUID(),
				senderId: socket.id,
				encryptedMessage,
			});
		});

		socket.on("room:public-key", ({ roomId, publicKey }) => {
			console.log("[Room] Public key:", roomId);
			socket.to(roomId).emit("room:public-key", { roomId, publicKey });
		});

		socket.on("file:offer", (payload) => {
			console.log("[File] Offering:", payload.roomId);

			socket.to(payload.roomId).emit("file:offer", payload);
		});

		socket.on("file:answer", ({ roomId, sdp }) => {
			console.log("[File] Answering:", roomId);

			socket.to(roomId).emit("file:answer", { sdp });
		});

		socket.on("file:candidate", ({ roomId, candidate }) => {
			console.log("[File] Candidating:", roomId);

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
