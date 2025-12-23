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

export type ChannelMessage =
	| {
			type: "META";
			id: string;
			meta: FileMeta;
	  }
	| {
			type: "CANCEL";
			id: string;
	  }
	| {
			type: "EOF";
			id: string;
	  }
	| {
			type: "ACK";
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
