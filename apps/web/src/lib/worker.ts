const chunks: ArrayBuffer[] = [];
let startTime: number | null = null;

let fileSize = 0;
let chunkSize = 16_000;
let totalChunks = 0;
let currentChunk = 0;
let lastProgress = -1;

type EventData =
	| {
			type: "fileInfo";
			fileSize: number;
			chunkSize?: number;
	  }
	| {
			type: "download";
	  }
	| {
			type: "dataChunk";
			data: ArrayBuffer;
	  };

self.addEventListener("message", (event: MessageEvent<EventData>) => {
	const data = event.data;

	/* ---------- FILE INFO ---------- */
	if (data.type === "fileInfo") {
		fileSize = data.fileSize;
		chunkSize = data.chunkSize ?? chunkSize;
		totalChunks = Math.ceil(fileSize / chunkSize);

		chunks.length = 0;
		currentChunk = 0;
		lastProgress = -1;
		startTime = null;
		return;
	}

	/* ---------- DOWNLOAD ---------- */
	if (data.type === "download") {
		if (!startTime) return;

		const blob = new Blob(chunks, {
			type: "application/octet-stream",
		});

		const timeTaken = performance.now() - startTime;

		self.postMessage({ type: "downloadComplete", blob, timeTaken });

		chunks.length = 0;
		currentChunk = 0;
		startTime = null;
		return;
	}

	/* ---------- DATA CHUNK ---------- */
	if (!(data instanceof ArrayBuffer)) return;
	if (!totalChunks) return;

	if (startTime === null) {
		startTime = performance.now();
	}

	chunks.push(data);
	currentChunk++;

	const progress = Math.floor((currentChunk / totalChunks) * 100);

	if (progress !== lastProgress) {
		lastProgress = progress;
		self.postMessage({ type: "updateProgress", progress });
	}
});
