import { zodResolver } from "@hookform/resolvers/zod";
import type { ServerToClientHandlers } from "@turbo-p2p-share/shared/types/socket";
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
import { UploadFile } from "@/components/upload-file";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useFileSocket } from "@/hooks/use-file-socket";
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
	const webrtc = useWebRTC();
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
	const onRoomCreated = useCallback<ServerToClientHandlers["room:create"]>(
		({ roomId }) => {
			form.setValue("myRoomId", roomId);
			console.log("Room created with ID:", roomId);
		},
		[form],
	);
	const onRoomJoined = useCallback<ServerToClientHandlers["room:join"]>(
		({ roomId }) => {
			setIsConnecting(false);
			setCurrentRoomId(roomId);
		},
		[],
	);
	const onRoomRequested = useCallback<ServerToClientHandlers["room:request"]>(
		async ({ roomId, userId }) => {
			const accept = await alert({
				title: "Join Request",
				description: `User ${userId} wants to join your room.`,
				cancel: { label: "Reject", props: { variant: "destructive" } },
				action: { label: "Accept" },
			});
			if (!accept) return;

			const pc = webrtc.initSender();
			pc.onicecandidate = (e) => {
				if (e.candidate) {
					shareSocket.candidate({
						roomId,
						candidate: e.candidate.toJSON(),
					});
				}
			};

			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);

			shareSocket.offer({ roomId, sdp: offer });
			shareSocket.acceptJoin({ roomId });
		},
		[alert, shareSocket, webrtc.initSender],
	);
	const onRoomAccepted = useCallback<
		ServerToClientHandlers["room:accept"]
	>(() => {
		setIsConnecting(false);
		console.log("Room accepted, waiting for offer...");
	}, []);
	const onRoomRejected = useCallback<ServerToClientHandlers["room:reject"]>(
		({ userId }) => {
			setIsConnecting(false);
			console.log(`Join request rejected for user ${userId}`);
		},
		[],
	);
	const onRoomTerminated = useCallback<
		ServerToClientHandlers["room:terminate"]
	>(() => {
		webrtc.cleanup();
		setCurrentRoomId(undefined);
		setIsConnecting(false);
	}, [webrtc.cleanup]);
	useRoomSocket({
		socket: shareSocket.socket,
		onRoomCreated,
		onRoomJoined,
		onRoomRequested,
		onRoomAccepted,
		onRoomRejected,
		onRoomTerminated,
	});
	//#endregion

	//#region File Socket Handlers
	const onCandidate = useCallback<ServerToClientHandlers["file:candidate"]>(
		async ({ candidate }) => {
			const pc = webrtc.pcRef.current;
			console.log("Current PC on File Candidate:", pc);
			if (!pc) return;
			await pc.addIceCandidate(candidate);
			console.log("Added ICE candidate:", candidate);
		},
		[webrtc.pcRef],
	);
	const onOffered = useCallback<ServerToClientHandlers["file:offer"]>(
		async ({ roomId, sdp }) => {
			const pc = webrtc.initReceiver();

			pc.onicecandidate = (e) => {
				if (e.candidate) {
					shareSocket.candidate({
						roomId,
						candidate: e.candidate.toJSON(),
					});
				}
			};

			await pc.setRemoteDescription(sdp);
			await webrtc.flushPendingCandidates();

			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);

			shareSocket.answer({ roomId, sdp: answer });
		},
		[
			shareSocket.answer,
			webrtc.initReceiver,
			shareSocket.candidate,
			webrtc.flushPendingCandidates,
		],
	);
	const onAnswered = useCallback<ServerToClientHandlers["file:answer"]>(
		async ({ sdp }) => {
			await webrtc.pcRef.current?.setRemoteDescription(sdp);
			await webrtc.flushPendingCandidates();
		},
		[webrtc.pcRef.current?.setRemoteDescription, webrtc.flushPendingCandidates],
	);
	useFileSocket({
		socket: shareSocket.socket,
		onCandidate,
		onOffered,
		onAnswered,
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
			console.error("Socket errors:", messages);
		},
		[],
	);
	useEffect(() => {
		shareSocket.createRoom({ roomId: shareSocket.userId });
		shareSocket.socket?.on("error", onError);
	}, [
		onError,
		shareSocket.createRoom,
		shareSocket.socket?.on,
		shareSocket.userId,
	]);
	//#endregion

	const handleSubmit: SubmitHandler<FormSchema> = (data) => {
		console.log(data);
	};

	const handleRoomRequest = async () => {
		if (!partnerRoomId) return;

		setIsConnecting(true);

		shareSocket.joinRoom({ roomId: partnerRoomId });
		shareSocket.requestJoin({
			roomId: partnerRoomId,
			userId: shareSocket.userId,
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
						<UploadFile
							file={webrtc.file}
							progress={webrtc.progress}
							sendFile={webrtc.sendFile}
							setFile={webrtc.setFile}
							setProgress={webrtc.setProgress}
							status={webrtc.status}
						/>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
};
