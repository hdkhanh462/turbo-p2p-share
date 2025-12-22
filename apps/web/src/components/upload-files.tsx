import { BanIcon, UploadIcon, XIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { FileList } from "@/components/file-list";
import { TransferFileItem } from "@/components/transfer-file-item";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
	FileUpload,
	FileUploadDropzone,
	FileUploadItem,
	FileUploadItemDelete,
	FileUploadItemMetadata,
	FileUploadItemPreview,
	type FileUploadProps,
} from "@/components/ui/file-upload";
import type { useWebRTC } from "@/hooks/use-webrtc";

type Props = {
	webrtc: ReturnType<typeof useWebRTC>;
};

export function UploadFiles({
	webrtc: { sentFiles, sendFile, cancelSendFile, setSentFiles },
}: Props) {
	const [files, setFiles] = React.useState<File[]>([]);

	const onUpload: NonNullable<FileUploadProps["onUpload"]> = React.useCallback(
		async (files, { onProgress, onSuccess, onError }) => {
			try {
				// Process each file individually
				const uploadPromises = files.map(async (file) => {
					try {
						// Simulate file upload with progress
						const totalChunks = 10;
						let uploadedChunks = 0;
						// Simulate chunk upload with delays
						for (let i = 0; i < totalChunks; i++) {
							// Simulate network delay (100-300ms per chunk)
							await new Promise((resolve) =>
								setTimeout(resolve, Math.random() * 200 + 100),
							);
							// Update progress for this specific file
							uploadedChunks++;
							const progress = (uploadedChunks / totalChunks) * 100;
							onProgress(file, progress);
						}
						// Simulate server processing delay
						await new Promise((resolve) => setTimeout(resolve, 500));
						onSuccess(file);
					} catch (error) {
						onError(
							file,
							error instanceof Error ? error : new Error("Upload failed"),
						);
					}
				});
				// Wait for all uploads to complete
				await Promise.all(uploadPromises);
			} catch (error) {
				// This handles any error that might occur outside the individual upload processes
				console.error("Unexpected error during upload:", error);
			}
		},
		[],
	);

	const onFileReject = React.useCallback((file: File, message: string) => {
		toast(message, {
			description: `"${file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name}" has been rejected`,
		});
	}, []);

	const onSendFile = async (file?: File) => {
		if (!file) return;
		try {
			setFiles((prev) =>
				prev.filter(
					(f) => f.name !== file.name && f.lastModified !== file.lastModified,
				),
			);
			await sendFile(file);
		} catch (error) {
			console.error("Upload failed", error);
		}
	};

	const removeSendingFile = (id: string) => {
		setSentFiles((prev) => prev.filter((f) => f.id !== id));
	};

	return (
		<Field>
			<FieldLabel>Upload Files</FieldLabel>
			<FileUpload
				value={files}
				onValueChange={setFiles}
				onFileReject={onFileReject}
				maxFiles={5}
				className="w-full"
				multiple
			>
				<FileUploadDropzone>
					<div className="flex flex-col items-center gap-1 text-center">
						<div className="flex items-center justify-center rounded-full border bg-muted p-2.5">
							<UploadIcon className="size-6 text-muted-foreground" />
						</div>
						<p className="font-medium text-sm">Drag & drop files here</p>
						<p className="text-muted-foreground text-xs">
							Or click to browse (max 5 files)
						</p>
					</div>
				</FileUploadDropzone>
				<FileList>
					{files.map((file) => (
						<FileItem
							key={`${file.name}-${file.lastModified}`}
							file={file}
							onSendFile={onSendFile}
						/>
					))}
					{sentFiles.map((data) => (
						<TransferFileItem
							key={data.id}
							data={data}
							action={
								<>
									{data.status === "sending" && (
										<Button
											variant="ghost"
											size="icon"
											className="size-7"
											onClick={() => cancelSendFile(data.id, "sender")}
										>
											<BanIcon />
										</Button>
									)}
									{data.status !== "sending" && data.status !== "completed" && (
										<Button
											variant="ghost"
											size="icon"
											className="size-7"
											onClick={() => onSendFile(data.file)}
										>
											<UploadIcon />
										</Button>
									)}
									{data.status !== "sending" && (
										<Button
											variant="ghost"
											size="icon"
											className="size-7"
											onClick={() => removeSendingFile(data.id)}
										>
											<XIcon />
										</Button>
									)}
								</>
							}
						/>
					))}
				</FileList>
			</FileUpload>
		</Field>
	);
}

function FileItem({
	file,
	onSendFile,
}: {
	file: File;
	onSendFile?: (file: File) => void;
}) {
	return (
		<FileUploadItem value={file} className="flex-col">
			<div className="flex w-full items-center gap-2">
				<FileUploadItemPreview />
				<FileUploadItemMetadata />
				<Button
					variant="ghost"
					size="icon"
					className="size-7"
					onClick={() => onSendFile?.(file)}
				>
					<UploadIcon />
				</Button>
				<FileUploadItemDelete asChild>
					<Button variant="ghost" size="icon" className="size-7">
						<XIcon />
					</Button>
				</FileUploadItemDelete>
			</div>
		</FileUploadItem>
	);
}
