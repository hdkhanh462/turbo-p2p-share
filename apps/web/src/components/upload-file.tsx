import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { useWebRTC } from "@/hooks/use-webrtc";

type Props = {
	webrtc: ReturnType<typeof useWebRTC>;
};

export const UploadFile = ({ webrtc }: Props) => {
	const [file, setFile] = useState<File | null>(null);
	return (
		<div className="w-full space-y-4 rounded-md border p-4">
			<h3>📤 Upload File (P2P)</h3>

			<p>
				Status: <strong>{webrtc.connected ? "🟢 Connected" : "⚪ Idle"}</strong>
			</p>

			<input
				type="file"
				onChange={(e) => {
					if (e.target.files?.[0]) {
						setFile(e.target.files[0]);
					}
				}}
			/>

			{file && (
				<div>
					<p>
						<strong>{file.name}</strong>
					</p>
					<p>{(file.size / 1024).toFixed(2)} KB</p>
				</div>
			)}

			<Button
				onClick={() => file && webrtc.sendFile(file)}
				disabled={!file || !webrtc.connected}
			>
				Send File
			</Button>

			{webrtc.incomingFile?.progress && (
				<div>
					<progress value={webrtc.incomingFile.progress} max={100} />
					<span> {webrtc.incomingFile.progress}%</span>
				</div>
			)}
		</div>
	);
};
