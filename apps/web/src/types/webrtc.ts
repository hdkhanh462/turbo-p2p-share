export type SignalPayload =
	| {
			type: "meta";
			data: TransferData;
	  }
	| {
			type: "canceled";
			by: "sender" | "receiver";
			id: string;
	  }
	| {
			type: "completed";
			id: string;
	  };

export type FileMeta = {
	name: string;
	size: number;
	mime: string;
};

export type TransferData = {
	id: string;
	file?: File;
	meta: FileMeta;
	progress: number;
	status: "sending" | "receiving" | "completed" | "canceled" | "failed";
};
