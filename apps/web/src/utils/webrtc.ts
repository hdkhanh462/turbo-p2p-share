import type { ChannelMessage } from "@/types/webrtc";

export const sendMessage = (
	channel: RTCDataChannel,
	payload: ChannelMessage,
) => {
	channel.send(JSON.stringify(payload));
};
