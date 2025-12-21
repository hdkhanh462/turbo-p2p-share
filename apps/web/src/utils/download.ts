import type { FileMeta } from "@/types/webrtc";

export function triggerFileDownload(meta: FileMeta, buffer: ArrayBuffer[]) {
	const blob = new Blob(buffer, {
		type: meta.mime,
	});

	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = meta.name;
	a.click();

	URL.revokeObjectURL(url);
}
