import { BanIcon, DownloadIcon, InboxIcon, XIcon } from "lucide-react";
import { FileList } from "@/components/file-list";
import { TransferFileItem } from "@/components/transfer-file-item";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import type { useWebRTC } from "@/hooks/use-webrtc";
import { downloadFile } from "@/utils/download";

type Props = {
	webrtc: ReturnType<typeof useWebRTC>;
};

export const ReceivedFiles = ({
	webrtc: { receivedFiles, setReceivedFiles, cancelSendFile },
}: Props) => {
	const removeReceivedFiles = (id: string) => {
		setReceivedFiles((prev) => prev.filter((f) => f.id !== id));
	};

	return (
		<Field>
			<FieldLabel>Received Files</FieldLabel>

			<FileList empty={<ReceivedFilesEmpty />}>
				{receivedFiles.map((data) => (
					<TransferFileItem
						key={data.id}
						data={data}
						action={
							<>
								{data.status === "completed" && (
									<Button
										variant="ghost"
										size="icon"
										className="size-7"
										onClick={() => data.file && downloadFile(data.file)}
									>
										<DownloadIcon />
									</Button>
								)}
								{data.status === "receiving" && (
									<Button
										variant="ghost"
										size="icon"
										className="size-7"
										onClick={() => cancelSendFile(data.id, "receiver")}
									>
										<BanIcon />
									</Button>
								)}
								{data.status !== "receiving" && (
									<Button
										variant="ghost"
										size="icon"
										className="size-7"
										onClick={() => removeReceivedFiles(data.id)}
									>
										<XIcon />
									</Button>
								)}
							</>
						}
					/>
				))}
			</FileList>
		</Field>
	);
};

function ReceivedFilesEmpty() {
	return (
		<Empty className="rounded-lg border-2 border-dashed p-8">
			<EmptyHeader>
				<EmptyMedia variant="icon" className="size-11.5 rounded-full border">
					<InboxIcon className="size-6 text-muted-foreground" />
				</EmptyMedia>

				<EmptyTitle>No files received</EmptyTitle>
			</EmptyHeader>
		</Empty>
	);
}
