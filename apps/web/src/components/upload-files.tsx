import { BanIcon, RefreshCcwIcon, UploadIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";
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
import type { useP2PSharing } from "@/hooks/use-p2p-sharing";
import type { UploadItem } from "@/hooks/use-upload-queue";

const MAX_FILES = 5;

type Props = {
	p2p: ReturnType<typeof useP2PSharing>;
};

export function UploadFiles({ p2p: { senderItems, addFiles } }: Props) {
	const [files, setFiles] = useState<File[]>([]);
	const uploadingItems = senderItems.filter(
		(item) => item.status === "uploading",
	);
	const waitingItems = senderItems.filter((item) => item.status === "waiting");
	const completedOrCancelledItems = senderItems.filter(
		(item) => item.status !== "uploading" && item.status !== "waiting",
	);

	const onSingleUpload = async (file: File) => {
		if (!file) return;

		addFiles([file]);
		setFiles((prev) =>
			prev.filter(
				(f) => f.name !== file.name && f.lastModified !== file.lastModified,
			),
		);
	};

	const onMultipleUpload: NonNullable<FileUploadProps["onUpload"]> =
		useCallback(
			async (files) => {
				addFiles(files);
				setFiles([]);
			},
			[addFiles],
		);

	const onFileReject = useCallback((file: File, message: string) => {
		toast(message, {
			description: `"${file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name}" has been rejected`,
		});
	}, []);

	return (
		<Field>
			<FieldLabel>Upload Files</FieldLabel>
			<FileUpload
				value={files}
				onValueChange={setFiles}
				onFileReject={onFileReject}
				onUpload={onMultipleUpload}
				maxFiles={MAX_FILES}
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
							Or click to browse (max {MAX_FILES} files)
						</p>
					</div>
				</FileUploadDropzone>
				<FileList>
					{files.length > 0 && (
						<>
							<div className="font-medium text-sm leading-snug">
								Selected files
							</div>
							{files.map((file) => (
								<FileItem
									key={`${file.name}-${file.lastModified}`}
									file={file}
									onSingleUpload={onSingleUpload}
								/>
							))}
						</>
					)}
					{uploadingItems.length > 0 && (
						<>
							<div className="font-medium text-sm leading-snug">Uploading</div>
							{uploadingItems.map((item) => (
								<SenderItem
									key={item.id}
									item={item}
									onSingleUpload={onSingleUpload}
								/>
							))}
						</>
					)}
					{waitingItems.length > 0 && (
						<>
							<div className="font-medium text-sm leading-snug">In-queue</div>
							{waitingItems.map((item) => (
								<SenderItem
									key={item.id}
									item={item}
									onSingleUpload={onSingleUpload}
								/>
							))}
						</>
					)}
					{completedOrCancelledItems.length > 0 && (
						<>
							<div className="font-medium text-sm leading-snug">
								Completed or Cancelled
							</div>
							{completedOrCancelledItems.map((item) => (
								<SenderItem
									key={item.id}
									item={item}
									onSingleUpload={onSingleUpload}
								/>
							))}
						</>
					)}
				</FileList>
			</FileUpload>
		</Field>
	);
}

function FileItem({
	file,
	onSingleUpload,
}: {
	file: File;
	onSingleUpload: (file: File) => void;
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
					onClick={() => onSingleUpload(file)}
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

function SenderItem({
	item,
	onSingleUpload,
}: {
	item: UploadItem;
	onSingleUpload: (file: File) => void;
}) {
	return (
		<TransferFileItem
			key={item.id}
			data={{ type: "upload", item: item }}
			action={
				<>
					{item.status === "uploading" && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={() => item.cancel()}
						>
							<BanIcon />
						</Button>
					)}
					{item.status === "waiting" && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={() => onSingleUpload(item.file)}
						>
							<UploadIcon />
						</Button>
					)}
					{(item.status === "cancelled" || item.status === "error") && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={() => item.retry()}
						>
							<RefreshCcwIcon />
						</Button>
					)}
					{item.status !== "uploading" && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={() => item.remove()}
						>
							<XIcon />
						</Button>
					)}
				</>
			}
		/>
	);
}
