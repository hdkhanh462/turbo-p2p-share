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
import type { useP2PSharing } from "@/hooks/use-p2p-sharing";
import { downloadFile } from "@/utils/download";

type Props = {
	p2p: ReturnType<typeof useP2PSharing>;
};

export const ReceivedFiles = ({ p2p: { receiverItems } }: Props) => {
	return (
		<Field>
			<FieldLabel>Received Files</FieldLabel>

			<FileList empty={<ReceivedFilesEmpty />}>
				{receiverItems.map((item) => (
					<TransferFileItem
						key={item.id}
						data={{ type: "receive", item }}
						action={
							<>
								{item.status === "done" && (
									<Button
										variant="ghost"
										size="icon"
										className="size-7"
										onClick={() => item.file && downloadFile(item.file)}
									>
										<DownloadIcon />
									</Button>
								)}
								{item.status === "receiving" && (
									<Button
										variant="ghost"
										size="icon"
										className="size-7"
										onClick={() => item.cancel()}
									>
										<BanIcon />
									</Button>
								)}
								{item.status !== "receiving" && (
									<Button
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
