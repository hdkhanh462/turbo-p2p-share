import type { Server as HttpServer } from "node:http";
import type {
	ClientInfo,
	ClientToServerHandlers,
	ServerToClientHandlers,
} from "@turbo-p2p-share/shared/types/socket";
import { Server } from "socket.io";
import { UAParser } from "ua-parser-js";

type Language = "en" | "vi";

const FRUITS: { [key in Language]: string }[] = [
	{ en: "Apple", vi: "Táo" },
	{ en: "Banana", vi: "Chuối" },
	{ en: "Orange", vi: "Cam" },
	{ en: "Mango", vi: "Xoài" },
	{ en: "Pineapple", vi: "Dứa" },
	{ en: "Strawberry", vi: "Dâu tây" },
	{ en: "Grape", vi: "Nho" },
	{ en: "Watermelon", vi: "Dưa hấu" },
	{ en: "Peach", vi: "Đào" },
	{ en: "Pear", vi: "Lê" },
	{ en: "Cherry", vi: "Anh đào" },
	{ en: "Avocado", vi: "Bơ" },
	{ en: "Coconut", vi: "Dừa" },
	{ en: "Papaya", vi: "Đu đủ" },
	{ en: "Dragon Fruit", vi: "Thanh long" },
	{ en: "Lychee", vi: "Vải" },
	{ en: "Longan", vi: "Nhãn" },
	{ en: "Durian", vi: "Sầu riêng" },
];

const ADJECTIVES: { [key in Language]: string }[] = [
	{ en: "Happy", vi: "Vui vẻ" },
	{ en: "Lucky", vi: "May mắn" },
	{ en: "Swift", vi: "Nhanh nhẹn" },
	{ en: "Quiet", vi: "Yên tĩnh" },
	{ en: "Brave", vi: "Dũng cảm" },
	{ en: "Smart", vi: "Thông minh" },
	{ en: "Gentle", vi: "Hiền lành" },
	{ en: "Cool", vi: "Cool Ngầu" },
	{ en: "Bright", vi: "Rực rỡ" },
];

interface InterServerEvents {
	ping: () => void;
}

type SocketData = {
	roomId: string;
	ipGroup: string;
	clientInfo: Omit<ClientInfo, "id">;
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

		const xff = socket.handshake.headers["x-forwarded-for"];
		const rawIp =
			xff && typeof xff === "string"
				? xff.split(",").pop()?.trim()
				: socket.handshake.address;

		const ipGroup = getIpGroup(rawIp || "");
		const clientInfo = getClientInfo(socket.handshake.headers["user-agent"]);
		const clientName = getRandomAlias();

		socket.data.ipGroup = `network_${ipGroup}`;
		socket.data.clientInfo = { ...clientInfo, name: clientName };
		socket.join(socket.data.ipGroup);
		console.log("[Socket] Joined IP group:", socket.data.ipGroup);

		const roomRequest = (roomId: string) => {
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
		};

		const cancelRequest = (roomId: string) => {
			socket.leave(roomId);
			socket.to(roomId).emit("room:request-cancel", {
				roomId,
				userId: socket.id,
			});
		};

		socket.on("network:request", ({ clientId }) => {
			console.log("[Network] Requesting:", clientId);

			const targetSocket = io.sockets.sockets.get(clientId);
			if (targetSocket) roomRequest(targetSocket.data.roomId);
		});

		socket.on("network:request-cancel", ({ clientId }) => {
			console.log("[Network] Request cancelling:", clientId);

			const targetSocket = io.sockets.sockets.get(clientId);
			if (targetSocket) cancelRequest(targetSocket.data.roomId);
		});

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

			const clients: ClientInfo[] = [];
			for (const id of io.sockets.adapter.rooms.get(socket.data.ipGroup) ||
				[]) {
				if (id !== socket.id) {
					const s = io.sockets.sockets.get(id);
					if (s) {
						const { name, deviceType, deviceModel } = s.data.clientInfo;
						clients.push({ id, name, deviceType, deviceModel });
					}
				}
			}
			socket.emit("network:connect", { clients });

			socket.to(socket.data.ipGroup).emit("network:join", {
				client: {
					id: socket.id,
					name: clientName,
					...clientInfo,
				},
			});
		});

		socket.on("room:request", ({ roomId }) => {
			console.log("[Room] Requesting:", roomId);

			roomRequest(roomId);
		});

		socket.on("room:request-cancel", ({ roomId }) => {
			console.log("[Room] Request cancelling:", roomId);

			cancelRequest(roomId);
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
				if (roomId.startsWith("room_") && roomId !== socket.id) {
					socket.to(roomId).emit("room:terminate");
				}
			});
			socket.to(socket.data.ipGroup).emit("network:leave", {
				clientId: socket.id,
			});
		});

		socket.on("disconnect", () => {
			console.log("[Socket] Disconnected:", socket.id);
		});
	});
}

function getIpGroup(ip: string) {
	// IPv6
	if (ip.includes(":")) {
		return ip.split(":").slice(0, 4).join(":");
	}

	// IPv4
	return ip;
}

function getRandomAlias(lang: Language = "en") {
	const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]?.[lang];
	const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)]?.[lang];

	return lang === "vi" ? `${fruit} ${adj}` : `${adj} ${fruit}`;
}

function getClientInfo(userAgent: string | undefined) {
	const p = new UAParser(userAgent).getResult();

	const deviceType =
		p.device.type ??
		(p.os.name === "Windows" || p.os.name === "Mac OS" ? "desktop" : "mobile");

	const deviceModel =
		p.os.name && p.browser.name
			? `${p.os.name} • ${p.browser.name}`
			: "Unknown";

	return { deviceType, deviceModel };
}
