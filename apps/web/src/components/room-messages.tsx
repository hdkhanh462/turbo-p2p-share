import { CheckIcon, ClipboardIcon, CopyIcon, XIcon } from "lucide-react";
import { useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
} from "@/components/ui/input-group";
import {
	Message,
	MessageContent,
	type MessageProps,
} from "@/components/ui/message";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useSocket } from "@/hooks/use-socket";

export interface ChatMessage {
	id: string;
	senderId: string;
	text: string;
}

interface Props {
	messages: ChatMessage[];
	onSendMessage?: (message: string) => void;
}

export const RoomMessages = ({ messages, onSendMessage }: Props) => {
	const [messageInput, setMessageInput] = useState("");

	const { socket } = useSocket();

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			setMessageInput(text);
		} catch (err) {
			console.error("Paste failed", err);
		}
	};

	const handleSendMessage = () => {
		if (onSendMessage && messageInput.trim() !== "") {
			onSendMessage(messageInput.trim());
			setMessageInput("");
		}
	};

	return (
		<div className="flex h-fit flex-col rounded-xl border">
			<div className="flex gap-2 p-4">
				<InputGroup>
					<TextareaAutosize
						data-slot="input-group-control"
						className="field-sizing-content flex min-h-16 w-full resize-none rounded-md bg-transparent px-3 py-2.5 text-base outline-none transition-[color,box-shadow] md:text-sm"
						placeholder="Type your message..."
						value={messageInput}
						onChange={(e) => setMessageInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSendMessage();
							}
						}}
					/>
					<InputGroupAddon
						align="block-end"
						className="items-center justify-between"
					>
						<div className="flex items-center">
							<InputGroupButton
								className="rounded-lg"
								variant="ghost"
								size="icon-sm"
								onClick={handlePaste}
							>
								<ClipboardIcon />
							</InputGroupButton>
							{messageInput && (
								<InputGroupButton
									className="rounded-lg text-destructive hover:text-destructive"
									variant="ghost"
									size="icon-sm"
									onClick={() => setMessageInput("")}
								>
									<XIcon />
								</InputGroupButton>
							)}
						</div>
						<InputGroupButton
							className="rounded-lg"
							variant="default"
							size="sm"
							disabled={!messageInput}
							onClick={handleSendMessage}
						>
							Send
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</div>
			<div className="flex max-h-118 min-h-118 flex-1 flex-col overflow-y-auto px-4">
				{messages.map((msg) => (
					<MessageItem
						key={msg.id}
						msg={msg}
						from={msg.senderId === socket?.id ? "sender" : "receiver"}
					/>
				))}
			</div>
		</div>
	);
};

function MessageItem({
	msg,
	from,
}: {
	msg: ChatMessage;
	from: MessageProps["from"];
}) {
	const { copyToClipboard, isCopied } = useCopyToClipboard();

	return (
		<Message from={from}>
			<MessageContent className="whitespace-pre-line group-[.is-sender]:order-2">
				{msg.text}
			</MessageContent>
			<Button
				variant="ghost"
				size="icon"
				className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-[.is-sender]:order-1"
				onClick={() => copyToClipboard(msg.text)}
			>
				{isCopied ? <CheckIcon /> : <CopyIcon />}
			</Button>
		</Message>
	);
}
