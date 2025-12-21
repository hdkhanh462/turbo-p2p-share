export type FileMeta = {
	id: string;
	name: string;
	size: number;
	mime: string;
};

export type FileState = {
	meta: FileMeta;
	progress: number;
	status: "uploading" | "downloading" | "completed";
};
