import { zodResolver } from "@hookform/resolvers/zod";
import type { ServerToClientHandlers } from "@turbo-p2p-share/shared/types/socket";
import { ArrowUpRightFromSquareIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { FormInput } from "@/components/form";
import { InputCopy } from "@/components/input-copy";
import Loader from "@/components/loader";
import { ReceivedFiles } from "@/components/received-files";
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
import { UploadFiles } from "@/components/upload-files";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { useSocket } from "@/hooks/use-socket";
import { useWebRTC } from "@/hooks/use-webrtc";

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
	const [isConnecting, setIsConnecting] = useState(false);
	const [currentRoomId, setCurrentRoomId] = useState<string>();

	const { alert } = useAlertDialog();
	const shareSocket = useSocket();
	const webrtc = useWebRTC({ socket: shareSocket.socket });
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

	//#region
	const onRoomCreated: ServerToClientHandlers["room:create"] = ({ roomId }) => {
		form.setValue("myRoomId", roomId);
		console.log("[Socket] Room created with ID:", roomId);
	};

	const onRoomJoined: ServerToClientHandlers["room:join"] = ({ roomId }) => {
		console.log("[Socket] Joined room:", roomId);
	};

	const onRoomRequested: ServerToClientHandlers["room:request"] = async ({
		roomId,
		userId,
	}) => {
		const accept = await alert({
			title: "Join Request",
			description: `User ${userId} wants to join your room.`,
			cancel: { label: "Reject", props: { variant: "destructive" } },
			action: { label: "Accept" },
		});
		if (!accept) {
			shareSocket.rejectJoin({ roomId });
			return;
		}

		webrtc.onReady(roomId);
		shareSocket.acceptJoin({ roomId });
	};

	const onRoomAccepted: ServerToClientHandlers["room:accept"] = ({
		roomId,
	}) => {
		setIsConnecting(false);
		setCurrentRoomId(roomId);
		console.log("[Socket] Room accepted, waiting for offer...");
	};

	const onRoomRejected: ServerToClientHandlers["room:reject"] = ({
		userId,
	}) => {
		setIsConnecting(false);
		console.log(`[Socket] Join request rejected by: ${userId}`);
	};

	const onRoomTerminated: ServerToClientHandlers["room:terminate"] = () => {
		webrtc.cleanup();
		setCurrentRoomId(undefined);
	};

	useRoomSocket({
		socket: shareSocket.socket,
		onRoomAccepted,
		onRoomCreated,
		onRoomJoined,
		onRoomRejected,
		onRoomRequested,
		onRoomTerminated,
	});
	//#endregion

	//#region Error Handler
	const onError = useCallback<ServerToClientHandlers["error"]>(
		({ messages }) => {
			setIsConnecting(false);
			toast.error("Socket Error", {
				description: (
					<ul>
						{messages.map((msg) => (
							<li key={msg}>{msg}</li>
						))}
					</ul>
				),
			});
			console.error("[Socket] Socket errors:", messages);
		},
		[],
	);
	useEffect(() => {
		shareSocket.createRoom({ roomId: shareSocket.randomId });
		shareSocket.socket?.on("error", onError);
	}, [
		onError,
		shareSocket.createRoom,
		shareSocket.socket?.on,
		shareSocket.randomId,
	]);
	//#endregion

	const handleRoomRequest = async () => {
		if (!partnerRoomId) return;

		setIsConnecting(true);

		shareSocket.joinRoom({ roomId: partnerRoomId });

		if (!shareSocket.socket?.id) return;
		shareSocket.requestJoin({
			roomId: partnerRoomId,
			userId: shareSocket.socket.id,
		});
	};

	const handleRoomTerminate = () => {
		if (currentRoomId) {
			shareSocket.terminateRoom(currentRoomId);
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
										<InputCopy
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
							<FormInput
								control={form.control}
								name="partnerRoomId"
								label="Partner Room ID"
								inputProps={{
									placeholder: "Enter Partner Room ID",
									autoComplete: "off",
								}}
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
									disabled={isConnecting}
									onClick={handleRoomRequest}
								>
									<Loader isLoading={isConnecting} />
									Connect
								</Button>
							)}
						</div>
						<UploadFiles webrtc={webrtc} />
						<ReceivedFiles webrtc={webrtc} />
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
};
