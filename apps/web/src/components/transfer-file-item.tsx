import * as React from "react";
import { FileItemProgress } from "@/components/file-download-item-progress";
import { formatBytes, getFileIcon } from "@/components/ui/file-upload";
import type { TransferData } from "@/types/webrtc";

type Props = {
	data: TransferData;
	action?: React.ReactNode;
};

export function TransferFileItem({ data, action }: Props) {
	const previewUrl = React.useMemo(() => {
		return data.file?.type.startsWith("image/")
			? URL.createObjectURL(data.file)
			: null;
	}, [data.file]);

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
							alt={data.meta.name}
							className="size-full object-cover"
						/>
					) : (
						getFileIcon({ type: data.meta.mime, name: data.meta.name })
					)}
				</div>

				{/* Metadata */}
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate font-medium text-sm">{data.meta.name}</span>
					<span className="truncate text-muted-foreground text-xs">
						{formatBytes(data.meta.size)}
					</span>
				</div>

				{/* Action */}
				{action}
			</div>

			{/* Progress */}
			{(data.status === "sending" || data.status === "receiving") && (
				<FileItemProgress progress={data.progress} />
			)}
		</div>
	);
}
