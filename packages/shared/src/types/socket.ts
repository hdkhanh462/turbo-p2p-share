export enum SocketEvent {
	JOIN_ROOM = "room:join",
	LEAVE_ROOM = "room:leave",
	ROOM_MESSAGE = "room:message",
	ROOM_JOINED = "room:joined",
	ROOM_LEFT = "room:left",
	ROOM_FULL = "room:full",
}

export type ServerToClientHandlers = {
	[SocketEvent.ROOM_JOINED]: (payload: {
		roomId: string;
		memberId: string;
	}) => void;
	[SocketEvent.ROOM_LEFT]: (payload: {
		roomId: string;
		memberId: string;
	}) => void;
	[SocketEvent.ROOM_MESSAGE]: (payload: {
		roomId: string;
		message: string;
		fromMemberId: string;
	}) => void;
	[SocketEvent.ROOM_FULL]: () => void;
};

export interface ClientToServerHandlers {
	[SocketEvent.JOIN_ROOM]: (payload: { roomId: string }) => void;
	[SocketEvent.LEAVE_ROOM]: (payload: { roomId: string }) => void;
	[SocketEvent.ROOM_MESSAGE]: (payload: {
		roomId: string;
		message: string;
	}) => void;
	[SocketEvent.ROOM_FULL]: () => void;
}
