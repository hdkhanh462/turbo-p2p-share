import { zodResolver } from "@hookform/resolvers/zod";
import {
	type ServerToClientHandlers,
	SocketEvent,
} from "@turbo-p2p-share/shared/types/socket";
import { ArrowUpRightFromSquareIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	Controller,
	type SubmitHandler,
	useForm,
	useWatch,
} from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { FormInput } from "@/components/form";
import { InputCopy } from "@/components/input-copy";
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
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSocket } from "@/hooks/use-socket";

const formSchema = z.object({
	myRoomId: z.string().nonempty("Room ID is required"),
	partnerRoomId: z.string().optional(),
	uploadedFile: z
		.instanceof(File, { message: "A valid file is required" })
		.optional(),
});

type FormSchema = z.infer<typeof formSchema>;

type ConnectedRoom = {
	roomId: string;
	memberIds: string[];
};

type Props = {
	roomId?: string;
};

export const ShareForm = ({ roomId }: Props) => {
	const [connectedRoom, setConnectedRoom] = useState<ConnectedRoom | null>(
		null,
	);
	const [isConnecting, setIsConnecting] = useState(false);

	const { alert } = useAlertDialog();
	const shareSocket = useSocket();
	const form = useForm<FormSchema>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			myRoomId: "",
			partnerRoomId: roomId || "",
		},
	});

	const partnerRoomId = useWatch({
		control: form.control,
		name: "partnerRoomId",
	});

	const handleError = useCallback<ServerToClientHandlers[SocketEvent.ERROR]>(
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
			console.error("Socket errors:", messages);
		},
		[],
	);

	const handleRoomPreCreated = useCallback<
		ServerToClientHandlers[SocketEvent.ROOM_PRE_CREATED]
	>(
		({ roomId }) => {
			form.setValue("myRoomId", roomId);
			console.log(`Room pre-created with ID: ${roomId}`);
		},
		[form],
	);

	const handleJoinRequested = useCallback<
		ServerToClientHandlers[SocketEvent.ROOM_JOIN_REQUESTED]
	>(
		async ({ roomId, guestUserId }) => {
			console.log(`Join request for room ${roomId} from user ${guestUserId}`);

			const accept = await alert({
				title: "Join Request",
				description: `User ${guestUserId} wants to join your room ${roomId}. Do you accept?`,
				cancel: {
					label: "Reject",
					props: { variant: "destructive" },
				},
				action: {
					label: "Accept",
				},
			});

			if (accept) shareSocket.acceptJoin(roomId);
			else shareSocket.rejectJoin(roomId);
		},
		[alert, shareSocket],
	);

	const handleRoomCreated = useCallback<
		ServerToClientHandlers[SocketEvent.ROOM_CREATED]
	>(({ roomId, memberIds }) => {
		setIsConnecting(false);
		setConnectedRoom({ roomId, memberIds });
		console.log(`Room created: ${roomId} with members ${memberIds.join(", ")}`);
	}, []);

	const handleTerminated = useCallback<
		ServerToClientHandlers[SocketEvent.ROOM_TERMINATED]
	>(
		({ roomId }) => {
			if (connectedRoom?.roomId === roomId) {
				setConnectedRoom(null);
				console.log(`Room terminated: ${roomId}`);
			}
		},
		[connectedRoom],
	);

	useEffect(() => {
		shareSocket.socket?.on(SocketEvent.ERROR, handleError);
		shareSocket.socket?.on(SocketEvent.ROOM_PRE_CREATED, handleRoomPreCreated);
		shareSocket.socket?.on(SocketEvent.ROOM_CREATED, handleRoomCreated);
		shareSocket.socket?.on(
			SocketEvent.ROOM_JOIN_REQUESTED,
			handleJoinRequested,
		);
		shareSocket.socket?.on(SocketEvent.ROOM_JOIN_REJECTED, ({ roomId }) => {
			setIsConnecting(false);
			console.log(`Join request rejected for room ${roomId}`);
		});
		shareSocket.socket?.on(SocketEvent.ROOM_TERMINATED, handleTerminated);
		shareSocket.socket?.on(
			SocketEvent.ROOM_MESSAGE_RECEIVED,
			({ senderId, message }) => {
				console.log(`Message from ${senderId}: ${message}`);
			},
		);
		shareSocket.socket?.on(
			SocketEvent.FILE_INFO_RECEIVED,
			({ senderId, fileName, fileSize }) => {
				console.log(
					`File info from ${senderId}: ${fileName} (${fileSize} bytes)`,
				);
			},
		);

		shareSocket.createRoom({ userId: shareSocket.userId });

		return () => {
			shareSocket.socket?.off();
		};
	}, [
		shareSocket.socket,
		shareSocket.userId,
		shareSocket.createRoom,
		handleError,
		handleJoinRequested,
		handleRoomPreCreated,
		handleRoomCreated,
		handleTerminated,
	]);

	const handleSubmit: SubmitHandler<FormSchema> = (data) => {
		console.log(data);
	};

	const handleJoinRequest = () => {
		if (partnerRoomId) {
			shareSocket.joinRequest({
				roomId: partnerRoomId,
				userId: shareSocket.userId,
			});
			setIsConnecting(true);
		}
	};

	const handleTerminate = () => {
		if (connectedRoom) {
			shareSocket.terminateRoom(connectedRoom.roomId);
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
				<form onSubmit={form.handleSubmit(handleSubmit)}>
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
							{connectedRoom ? (
								<Button
									type="button"
									variant="destructive"
									onClick={handleTerminate}
								>
									Terminate
								</Button>
							) : (
								<Button
									type="button"
									disabled={isConnecting}
									onClick={handleJoinRequest}
								>
									<Loader isLoading={isConnecting} />
									Connect
								</Button>
							)}
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
};
