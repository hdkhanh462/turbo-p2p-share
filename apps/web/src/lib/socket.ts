import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "@turbo-p2p-share/shared/types/socket";
import { io, type Socket } from "socket.io-client";

export class SignalingClient {
	private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
	private autoConnect: boolean;

	constructor(url: string, autoConnect = true) {
		this.socket = io(url, {
			autoConnect,
		});
		this.autoConnect = autoConnect;
		this.registerEventHandlers();
	}

	private registerEventHandlers() {
		this.socket.on("connect", () => {
			console.log("Connected to signaling server with ID:", this.socket.id);
		});
		this.socket.on("peer-joined", ({ id, deviceName }) => {
			console.log(`Peer joined: ${id} (${deviceName})`);
		});
		this.socket.on("peer-left", ({ id }) => {
			console.log(`Peer left: ${id}`);
		});
	}

	get id() {
		return this.socket.id;
	}

	connect() {
		if (this.autoConnect) return;
		this.socket.connect();
	}

	register(deviceName: string) {
		this.socket.emit("register", { deviceName });
	}
}
