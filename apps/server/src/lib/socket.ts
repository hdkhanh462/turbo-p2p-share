import type { Server as HttpServer } from "node:http";
import {
	type ClientToServerHandlers,
	type ServerToClientHandlers,
	SocketEvent,
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
		ClientToServerHandlers,
		ServerToClientHandlers,
		InterServerEvents,
		SocketData
	>(server, {
		cors: { origin: "*" },
	});

	io.on("connection", (socket) => {
		console.log("Socket connected:", socket.id);

		socket.on(SocketEvent.JOIN_ROOM, ({ roomId }) => {
			// Prevent joining if room already has 2 members
			const room = io.sockets.adapter.rooms.get(roomId);
			if (room && room.size >= 2) {
				socket.emit(SocketEvent.ROOM_FULL);
				console.log(
					`Socket ${socket.id} failed to join room ${roomId}: room is full`,
				);
				return;
			}

			socket.join(roomId);
			socket
				.to(roomId)
				.emit(SocketEvent.ROOM_JOINED, { roomId, memberId: socket.id });
			console.log(`Socket ${socket.id} joined room ${roomId}`);
		});

		socket.on(SocketEvent.LEAVE_ROOM, ({ roomId }) => {
			socket.leave(roomId);
			socket
				.to(roomId)
				.emit(SocketEvent.ROOM_LEFT, { roomId, memberId: socket.id });
			console.log(`Socket ${socket.id} left room ${roomId}`);
		});

		socket.on(SocketEvent.ROOM_MESSAGE, ({ roomId, message }) => {
			socket.to(roomId).emit(SocketEvent.ROOM_MESSAGE, {
				roomId,
				message,
				fromMemberId: socket.id,
			});
			console.log(
				`Socket ${socket.id} sent message to room ${roomId}: ${message}`,
			);
		});

		socket.on("disconnecting", () => {
			console.log("Socket disconnecting:", socket.id);
		});

		socket.on("disconnect", () => {
			console.log("Socket disconnected:", socket.id);
		});
	});
}
