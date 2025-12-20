export enum SocketEvent {
	ROOM_PRE_CREATE = "room:pre-create",
	ROOM_JOIN_REQUEST = "room:join-request",
	ROOM_JOIN_ACCEPT = "room:join-accept",
	ROOM_JOIN_REJECT = "room:join-reject",
	ROOM_TERMINATE = "room:terminate",
	ROOM_MESSAGE = "room:message",
	FILE_INFO = "file:info",
	ERROR = "error",
	ROOM_PRE_CREATED = "room:pre-created",
	ROOM_CREATED = "room:created",
	ROOM_JOIN_REQUESTED = "room:join-requested",
	ROOM_JOIN_REJECTED = "room:join-rejected",
	ROOM_TERMINATED = "room:terminated",
	ROOM_MESSAGE_RECEIVED = "room:message-received",
	FILE_INFO_RECEIVED = "file:info-received",
}

export type ServerToClientHandlers = {
	[SocketEvent.ERROR]: (payload: { messages: string[] }) => void;
	[SocketEvent.ROOM_PRE_CREATED]: (payload: { roomId: string }) => void;
	[SocketEvent.ROOM_CREATED]: (payload: {
		roomId: string;
		memberIds: string[];
	}) => void;
	[SocketEvent.ROOM_JOIN_REQUESTED]: (payload: {
		roomId: string;
		guestUserId: string;
	}) => void;
	[SocketEvent.ROOM_JOIN_REJECTED]: (payload: { roomId: string }) => void;
	[SocketEvent.ROOM_MESSAGE_RECEIVED]: (payload: {
		senderId: string;
		roomId: string;
		message: string;
	}) => void;
	[SocketEvent.ROOM_TERMINATED]: (payload: { roomId: string }) => void;
	[SocketEvent.FILE_INFO_RECEIVED]: (payload: {
		senderId: string;
		fileName: string;
		fileSize: number;
	}) => void;
};

export interface ClientToServerHandlers {
	[SocketEvent.ROOM_PRE_CREATE]: (payload: { userId: string }) => void;
	[SocketEvent.ROOM_JOIN_REQUEST]: (payload: {
		roomId: string;
		userId: string;
	}) => void;
	[SocketEvent.ROOM_JOIN_ACCEPT]: (roomId: string) => void;
	[SocketEvent.ROOM_JOIN_REJECT]: (roomId: string) => void;
	[SocketEvent.ROOM_TERMINATE]: (roomId: string) => void;
	[SocketEvent.ROOM_MESSAGE]: (payload: {
		roomId: string;
		message: string;
	}) => void;
	[SocketEvent.FILE_INFO]: (payload: {
		roomId: string;
		fileName: string;
		fileSize: number;
	}) => void;
}
