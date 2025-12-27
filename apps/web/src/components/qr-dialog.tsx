import { ArrowUpRightSquareIcon, QrCodeIcon } from "lucide-react";
import QRCode from "react-qr-code";
import { InputCopyPaste } from "@/components/input-copy-paste";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";

interface Props {
	value: string;
}

export const QRDialog = ({ value }: Props) => {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					type="button"
					size="icon"
					onClick={(e) => {
						e.currentTarget.blur();
					}}
				>
					<QrCodeIcon />
				</Button>
			</DialogTrigger>
			<DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
				<DialogHeader>
					<DialogTitle className="text-center">
						Scan this QR code to join the room
					</DialogTitle>
					<DialogDescription className="sr-only">
						Scan this QR code to join the room
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					<div className="flex justify-center">
						<QRCode value={value} className="rounded-xl border p-6" />
					</div>
					<div className="flex gap-2">
						<InputCopyPaste value={value} onChange={() => {}} readOnly />
						<a
							href={value}
							target="_blank"
							rel="noreferrer"
							className={buttonVariants({ size: "icon" })}
						>
							<ArrowUpRightSquareIcon />
						</a>
					</div>
				</FieldGroup>
			</DialogContent>
		</Dialog>
	);
};
