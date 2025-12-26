type RoomAccessDenialReason = "ROOM_FULL" | "HOST_REJECTED" | "HOST_BUSY";

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
	"file:offer": (payload: {
		roomId: string;
		sdp: RTCSessionDescriptionInit;
	}) => void;
	"file:answer": (payload: { sdp: RTCSessionDescriptionInit }) => void;
	"file:candidate": (payload: { candidate: RTCIceCandidateInit }) => void;
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
}
