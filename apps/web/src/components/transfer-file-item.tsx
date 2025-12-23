import * as React from "react";
import { FileItemProgress } from "@/components/file-download-item-progress";
import { formatBytes, getFileIcon } from "@/components/ui/file-upload";
import type { UploadItem } from "@/hooks/use-upload-queue";
import type { ReceiveItem } from "@/hooks/use-webrtc-receiver";
import type { FileMeta } from "@/types/webrtc";

type Props = {
	data:
		| { type: "upload"; item: UploadItem }
		| { type: "receive"; item: ReceiveItem };
	action?: React.ReactNode;
};

export function TransferFileItem({ data, action }: Props) {
	const meta: FileMeta =
		data.type === "upload"
			? {
					name: data.item.file.name,
					mime: data.item.file.type,
					size: data.item.file.size,
				}
			: data.item.meta;

	const previewUrl = React.useMemo(() => {
		return data.item.file?.type.startsWith("image/")
			? URL.createObjectURL(data.item.file)
			: null;
	}, [data.item.file]);

	React.useEffect(() => {
		return () => {
			previewUrl && URL.revokeObjectURL(previewUrl);
		};
	}, [previewUrl]);

	return (
		<div className="relative flex flex-col gap-2 rounded-md border p-3">
			{/* Row */}
			<div className="flex items-center gap-2.5">
				{/* Preview */}
				<div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-accent/50 [&>svg]:size-10">
					{previewUrl ? (
						<img
							src={previewUrl}
							alt={meta.name}
							className="size-full object-cover"
						/>
					) : (
						getFileIcon({ name: meta.name, type: meta.mime })
					)}
				</div>

				{/* Metadata */}
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate font-medium text-sm">{meta.name}</span>
					<span className="truncate text-muted-foreground text-xs">
						{formatBytes(meta.size)}
					</span>
				</div>

				{/* Action */}
				{action}
			</div>

			{/* Progress */}
			{(data.item.status === "uploading" ||
				data.item.status === "receiving") && (
				<FileItemProgress progress={data.item.progress} />
			)}
		</div>
	);
}
