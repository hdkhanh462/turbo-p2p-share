import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRightFromSquareIcon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import z from "zod";

import { InputCopyPaste } from "@/components/input-copy-paste";
import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { useP2PSharing } from "@/hooks/use-p2p-sharing";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { useSocket } from "@/hooks/use-socket";

const formSchema = z.object({
	myRoomId: z.string().nonempty("Room ID is required"),
	partnerRoomId: z.string().optional(),
	uploadedFile: z
		.instanceof(File, { message: "A valid file is required" })
		.optional(),
});

type FormSchema = z.infer<typeof formSchema>;

type Props = {
	roomIdParam?: string;
};

export const ShareForm = ({ roomIdParam }: Props) => {
	const shareSocket = useSocket();
	const p2p = useP2PSharing(shareSocket.socket);

	const form = useForm<FormSchema>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			myRoomId: "",
			partnerRoomId: roomIdParam || "",
		},
	});

	const partnerRoomId = useWatch({
		control: form.control,
		name: "partnerRoomId",
	});

	const { connecting, currentRoomId } = useRoomSocket({
		socket: shareSocket.socket,
		onRoomCreated: ({ roomId }) => {
			form.setValue("myRoomId", roomId);
		},
		onRoomRequested: ({ roomId }) => {
			p2p.connect(roomId);
		},
		onRoomTerminated: () => {
			p2p.cleanup();
		},
	});

	const handleRoomRequest = async () => {
		if (!partnerRoomId) return;

		shareSocket.socket?.emit("room:join", { roomId: partnerRoomId });

		if (!shareSocket.socket?.id) return;
		shareSocket.socket.emit("room:request", {
			roomId: partnerRoomId,
			userId: shareSocket.socket.id,
		});
	};

	const handleRoomTerminate = () => {
		if (currentRoomId) {
			shareSocket.socket?.emit("room:terminate", currentRoomId);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>P2P Share</CardTitle>
				<CardDescription>
					Connect to the same network to sharing files
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form>
					<FieldGroup>
						<div className="flex items-end gap-2">
							<Controller
								name="myRoomId"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel>My Room ID</FieldLabel>
										<InputCopyPaste
											{...field}
											aria-invalid={fieldState.invalid}
											placeholder="Your Room ID"
											readOnly
										/>
										{fieldState.invalid && (
											<FieldError errors={[fieldState.error]} />
										)}
									</Field>
								)}
							/>
							<Button type="button" size="icon">
								<ArrowUpRightFromSquareIcon />
							</Button>
						</div>
						<div className="flex items-end gap-2">
							<Controller
								name="partnerRoomId"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel>Partner's Room ID</FieldLabel>
										<InputCopyPaste
											{...field}
											aria-invalid={fieldState.invalid}
											placeholder="Enter Partner Room ID"
											autoComplete="off"
											showCopy={false}
											showPaste
											showClear
										/>
										{fieldState.invalid && (
											<FieldError errors={[fieldState.error]} />
										)}
									</Field>
								)}
							/>
							{currentRoomId ? (
								<Button
									type="button"
									variant="destructive"
									onClick={handleRoomTerminate}
								>
									Terminate
								</Button>
							) : (
								<Button
									type="button"
									disabled={connecting}
									onClick={handleRoomRequest}
								>
									<Loader isLoading={connecting} />
									Connect
								</Button>
							)}
						</div>
						{/* <UploadFiles webrtc={webrtc} />
						<ReceivedFiles webrtc={webrtc} /> */}
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
};
