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

type SocketData = {
	userId: string;
};

export interface PendingRoom {
	ownerSocketId: string;
	ownerUserId: string;
	guestSocketId?: string;
	createdAt: number;
}

export function setupSocket(
	server: HttpServer,
	pendingRooms: Record<string, PendingRoom>,
) {
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

		socket.on(SocketEvent.ROOM_PRE_CREATE, ({ userId }) => {
			socket.data.userId = userId;

			const roomId = crypto.randomUUID();
			pendingRooms[roomId] = {
				ownerSocketId: socket.id,
				ownerUserId: userId,
				createdAt: Date.now(),
			};
			socket.emit(SocketEvent.ROOM_PRE_CREATED, { roomId });
			console.log(`Room pre-created with ID: ${roomId} by user: ${userId}`);
		});

		socket.on(SocketEvent.ROOM_JOIN_REQUEST, ({ roomId, userId }) => {
			const room = pendingRooms[roomId];
			if (!room || room.guestSocketId) {
				socket.emit(SocketEvent.ERROR, {
					messages: ["Room not found or already has a guest."],
				});
				console.log(`Room ${roomId} not found or already has a guest.`);
				return;
			}

			if (room.ownerUserId === userId) {
				socket.emit(SocketEvent.ERROR, {
					messages: ["Owner cannot join their own room as guest."],
				});
				console.log(
					`Owner ${userId} cannot join their own room ${roomId} as guest.`,
				);
				return;
			}

			room.guestSocketId = socket.id;
			socket.data.userId = userId;

			io.to(room.ownerSocketId).emit(SocketEvent.ROOM_JOIN_REQUESTED, {
				roomId,
				guestUserId: userId,
			});
			console.log(`Join request for room ${roomId} from user ${userId}`);
		});

		socket.on(SocketEvent.ROOM_JOIN_ACCEPT, (roomId) => {
			const room = pendingRooms[roomId];
			if (!room || !room.guestSocketId) return;

			const owner = io.sockets.sockets.get(room.ownerSocketId);
			const guest = io.sockets.sockets.get(room.guestSocketId);
			if (!owner || !guest) return;

			owner.join(roomId);
			guest.join(roomId);

			io.to(roomId).emit(SocketEvent.ROOM_CREATED, {
				roomId,
				memberIds: [room.ownerUserId, guest.data.userId],
			});

			delete pendingRooms[roomId];
			console.log(`Join request accepted for room ${roomId}`);
		});

		socket.on(SocketEvent.ROOM_JOIN_REJECT, (roomId) => {
			const room = pendingRooms[roomId];
			if (!room || !room.guestSocketId) return;
			const guest = io.sockets.sockets.get(room.guestSocketId);
			if (guest) {
				guest.emit(SocketEvent.ROOM_JOIN_REJECTED, { roomId });
				room.guestSocketId = undefined;
			}
			console.log(`Join request rejected for room ${roomId}`);
		});

		socket.on(SocketEvent.ROOM_TERMINATE, (roomId) => {
			io.to(roomId).emit(SocketEvent.ROOM_TERMINATED, { roomId });
			const room = pendingRooms[roomId];
			if (room) {
				const owner = io.sockets.sockets.get(room.ownerSocketId);
				const guest = room.guestSocketId
					? io.sockets.sockets.get(room.guestSocketId)
					: null;
				if (owner) owner.leave(roomId);
				if (guest) guest.leave(roomId);
				delete pendingRooms[roomId];
			}
			console.log(`Room terminated: ${roomId}`);
		});

		socket.on(SocketEvent.FILE_INFO, ({ roomId, fileName, fileSize }) => {
			socket.to(roomId).emit(SocketEvent.FILE_INFO_RECEIVED, {
				senderId: socket.id,
				fileName,
				fileSize,
			});
			console.log(
				`Received file info from ${socket.id} to ${roomId}: ${fileName} (${fileSize} bytes)`,
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
