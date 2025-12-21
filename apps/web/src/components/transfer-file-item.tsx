import * as React from "react";
import { FileItemProgress } from "@/components/file-download-item-progress";
import { formatBytes, getFileIcon } from "@/components/ui/file-upload";
import type { TransferFile } from "@/hooks/use-webrtc";

type Props = {
	file: File;
	data: TransferFile;
	action?: React.ReactNode;
};

export function TransferFileItem({ file, data, action }: Props) {
	const previewUrl = React.useMemo(() => {
		if (file.type.startsWith("image/")) {
			return URL.createObjectURL(file);
		}
		return null;
	}, [file]);

	React.useEffect(() => {
		return () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
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
							alt={file.name}
							className="size-full object-cover"
						/>
					) : (
						getFileIcon(file)
					)}
				</div>

				{/* Metadata */}
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate font-medium text-sm">{file.name}</span>
					<span className="truncate text-muted-foreground text-xs">
						{formatBytes(file.size)}
					</span>
				</div>

				{/* Action */}
				{action}
			</div>

			{/* Progress */}
			{data.status === "sending" && (
				<FileItemProgress progress={data.progress} />
			)}
		</div>
	);
}
