import { zodResolver } from "@hookform/resolvers/zod";
import { PauseIcon } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import z from "zod";

import { InputCopyPaste } from "@/components/input-copy-paste";
import Loader from "@/components/loader";
import { ModeToggle } from "@/components/mode-toggle";
import { QRDialog } from "@/components/qr-dialog";
import { ReceivedFiles } from "@/components/received-files";
import { SettingsDialog } from "@/components/settings-dialog";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
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
	const { socket, myRoomId } = useSocket();
	const p2p = useP2PSharing(socket);

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

	const { connecting, currentRoomId, request, cancelRequest, terminate } =
		useRoomSocket(socket, {
			onRoomCreated: ({ roomId }) => {
				console.log("[Room] Created:", roomId);

				form.setValue("myRoomId", roomId);
			},
			onRoomRequested: (payload, accept) => {
				console.log("[Room] Request received:", { payload, accept });

				if (accept) p2p.connect(payload.roomId);
			},
			onRoomRequestCancelled: (payload) => {
				console.log("[Room] Request cancelled:", payload);
			},
			onRoomTerminated: () => {
				console.log("[Room] Terminated");

				p2p.cleanup();
			},
			onRoomAccepted: (payload) => {
				console.log("[Room] Accepted:", payload);
			},
			onRoomRejected: (payload) => {
				console.log("[Room] Rejected: ", payload);
			},
		});

	useEffect(() => {
		socket?.emit("room:create", { roomId: myRoomId });
	}, [socket, myRoomId]);

	const handleRoomRequest = () => {
		if (partnerRoomId) request(partnerRoomId);
	};

	const handleRoomRequestCancel = () => {
		if (partnerRoomId) cancelRequest(partnerRoomId);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>P2P Share</CardTitle>
				<CardDescription>
					Connect to the same network to sharing files
				</CardDescription>
				<CardAction className="flex gap-2">
					<ModeToggle />
					<SettingsDialog />
				</CardAction>
			</CardHeader>
			<CardContent>
				<form onSubmit={(e) => e.preventDefault()}>
					<FieldGroup>
						<div className="flex items-end gap-2">
							<Controller
								name="myRoomId"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={`share-form-${field.name}`}>
											My Room ID
										</FieldLabel>
										<InputCopyPaste
											{...field}
											id={`share-form-${field.name}`}
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
							<QRDialog
								value={`${import.meta.env.VITE_APP_URL}?roomId=${myRoomId}`}
							/>
						</div>
						<div className="flex items-end gap-2">
							<Controller
								name="partnerRoomId"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={`share-form-${field.name}`}>
											Partner's Room ID
										</FieldLabel>
										<InputCopyPaste
											{...field}
											id={`share-form-${field.name}`}
											aria-invalid={fieldState.invalid}
											placeholder="Enter Partner Room ID"
											autoComplete="off"
											showCopy={false}
											readOnly={connecting || !!currentRoomId}
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
								<Button type="button" variant="destructive" onClick={terminate}>
									Terminate
								</Button>
							) : (
								<div className="flex items-center gap-2">
									{connecting && (
										<Button
											type="button"
											variant="destructive"
											size="icon"
											onClick={handleRoomRequestCancel}
										>
											<PauseIcon />
										</Button>
									)}
									<Button
										type="button"
										disabled={connecting}
										onClick={handleRoomRequest}
									>
										<Loader isLoading={connecting} />
										Connect
									</Button>
								</div>
							)}
						</div>
						{currentRoomId && (
							<>
								<UploadFiles p2p={p2p} />
								<ReceivedFiles p2p={p2p} />
							</>
						)}
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
};
