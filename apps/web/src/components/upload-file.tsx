import { Button } from "@/components/ui/button";
import type { RTCDataChannelStatus } from "@/hooks/use-webrtc";

type Props = {
	file: File | null;
	status: RTCDataChannelStatus;
	progress: number;
	setFile: (file: File) => void;
	sendFile: () => void;
	setProgress: (progress: number) => void;
	setStatus: (status: RTCDataChannelStatus) => void;
};

export const UploadFile = ({
	file,
	status,
	progress,
	setFile,
	sendFile,
	setProgress,
	setStatus,
}: Props) => {
	return (
		<div
			style={{
				border: "1px solid #ddd",
				padding: 16,
				width: 320,
				borderRadius: 8,
			}}
		>
			<h3>📤 Upload File (P2P)</h3>

			<p>
				Status:{" "}
				<strong>
					{status === "connected" && "🟢 Connected"}
					{status === "connecting" && "🟡 Connecting"}
					{status === "sending" && "📤 Sending"}
					{status === "done" && "✅ Done"}
					{status === "idle" && "⚪ Idle"}
				</strong>
			</p>

			<input
				type="file"
				onChange={(e) => {
					if (e.target.files?.[0]) {
						setFile(e.target.files[0]);
						setProgress(0);
						if (status === "done") setStatus("connected");
					}
				}}
			/>

			{file && (
				<div style={{ marginTop: 8 }}>
					<p>
						<strong>{file.name}</strong>
					</p>
					<p>{(file.size / 1024).toFixed(2)} KB</p>
				</div>
			)}

			<Button
				onClick={sendFile}
				disabled={!file || status !== "connected"}
				style={{
					marginTop: 12,
					padding: "8px 12px",
					width: "100%",
					cursor: status === "connected" ? "pointer" : "not-allowed",
				}}
			>
				Send File
			</Button>

			{status === "sending" && (
				<div style={{ marginTop: 12 }}>
					<progress value={progress} max={100} />
					<span> {progress}%</span>
				</div>
			)}
		</div>
	);
};
