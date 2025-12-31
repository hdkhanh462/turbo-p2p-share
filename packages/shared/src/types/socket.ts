import type { EncryptedPayload } from "./e2e-encryption";

type RoomAccessDenialReason = "ROOM_FULL" | "HOST_REJECTED" | "HOST_BUSY";

export type ClientInfo = {
	id: string;
	name: string;
	deviceType:
		| "console"
		| "desktop"
		| "embedded"
		| "mobile"
		| "smarttv"
		| "tablet"
		| "wearable"
		| "xr"
		| undefined;
	deviceModel: string;
};

export type ServerToClientHandlers = {
	error: (payload: { messages: string[] }) => void;
	"room:create": (payload: { roomId: string }) => void;
	"room:request": (payload: { roomId: string; userId: string }) => void;
	"room:request-cancel": (payload: { roomId: string; userId: string }) => void;
	"room:accept": (payload: { roomId: string }) => void;
	"room:reject": (payload: {
		roomId: string;
		reason: RoomAccessDenialReason;
	}) => void;
	"room:terminate": () => void;
	"room:message": (payload: {
		id: string;
		senderId: string;
		encryptedMessage: EncryptedPayload;
	}) => void;
	"room:public-key": (payload: { roomId: string; publicKey: string }) => void;
	"file:offer": (payload: {
		roomId: string;
		sdp: RTCSessionDescriptionInit;
	}) => void;
	"file:answer": (payload: { sdp: RTCSessionDescriptionInit }) => void;
	"file:candidate": (payload: { candidate: RTCIceCandidateInit }) => void;
	"network:connect": (payload: { clients: ClientInfo[] }) => void;
	"network:join": (payload: { client: ClientInfo }) => void;
	"network:leave": (payload: { clientId: ClientInfo["id"] }) => void;
	"network:request-cancel": (payload: { clientId: ClientInfo["id"] }) => void;
};

export interface ClientToServerHandlers {
	"room:create": (payload: { roomId: string }) => void;
	"room:request": (payload: { roomId: string }) => void;
	"room:request-cancel": (payload: { roomId: string }) => void;
	"room:accept": (payload: { roomId: string }) => void;
	"room:reject": (payload: {
		roomId: string;
		userId: string;
		reason: RoomAccessDenialReason;
	}) => void;
	"room:terminate": (roomId: string) => void;
	"room:message": (payload: {
		roomId: string;
		encryptedMessage: EncryptedPayload;
	}) => void;
	"room:public-key": (payload: { roomId: string; publicKey: string }) => void;
	"file:offer": (payload: {
		roomId: string;
		sdp: RTCSessionDescriptionInit;
	}) => void;
	"file:answer": (payload: {
		roomId: string;
		sdp: RTCSessionDescriptionInit;
	}) => void;
	"file:candidate": (payload: {
		roomId: string;
		candidate: RTCIceCandidateInit;
	}) => void;
	"network:request": (payload: { clientId: ClientInfo["id"] }) => void;
	"network:request-cancel": (payload: { clientId: ClientInfo["id"] }) => void;
}
