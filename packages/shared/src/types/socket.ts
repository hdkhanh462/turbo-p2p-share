export interface ServerToClientEvents {
	"peer-joined": (payload: { id: string; deviceName: string }) => void;
	"peer-left": (payload: { id: string }) => void;
}

export interface ClientToServerEvents {
	register: (payload: { deviceName: string }) => void;
}
