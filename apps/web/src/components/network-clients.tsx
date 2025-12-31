import type { ClientInfo } from "@turbo-p2p-share/shared/types/socket";
import { PauseIcon, WifiIcon } from "lucide-react";
import Loader from "@/components/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from "@/components/ui/item";
import { useSocket } from "@/hooks/use-socket";

export const NetworkClients = () => {
	const { connecting, networkClients, networkRequest, cancelRequest } =
		useSocket();

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					Same Network Devices{" "}
					{networkClients.length > 0 && <span>({networkClients.length})</span>}
				</CardTitle>
				<CardDescription>
					Only devices in the same local network are show
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{networkClients.map((client) => (
						<ClientItem
							key={client.id}
							client={client}
							connecting={connecting}
							onConnect={() => networkRequest(client.id)}
							onCancelRequest={() => cancelRequest(client.id)}
						/>
					))}
				</div>
				{networkClients.length === 0 && <EmptyNetworkClients />}
			</CardContent>
		</Card>
	);
};

function ClientItem({
	client,
	connecting,
	onConnect,
	onCancelRequest,
}: {
	client: ClientInfo;
	connecting: boolean;
	onConnect?: () => void;
	onCancelRequest?: () => void;
}) {
	return (
		<div className="w-full space-y-6">
			<Item variant="outline">
				<ItemContent className="gap-2">
					<ItemTitle className="text-base">{client.name}</ItemTitle>
					<ItemDescription className="flex gap-2">
						<Badge variant="outline" className="text-muted-foreground">
							{client.deviceModel}
						</Badge>
						<Badge
							variant="outline"
							className="text-muted-foreground capitalize"
						>
							{client.deviceType}
						</Badge>
					</ItemDescription>
				</ItemContent>
				<ItemActions>
					{connecting && (
						<Button variant="destructive" size="icon" onClick={onCancelRequest}>
							<PauseIcon />
						</Button>
					)}
					<Button type="button" disabled={connecting} onClick={onConnect}>
						<Loader isLoading={connecting} />
						Connect
					</Button>
				</ItemActions>
			</Item>
		</div>
	);
}

function EmptyNetworkClients() {
	return (
		<Empty className="max-h-35.5 rounded-lg border-2 border-dashed p-8">
			<EmptyHeader>
				<EmptyMedia variant="icon" className="size-11.5 rounded-full border">
					<WifiIcon className="size-6 text-primary" />
				</EmptyMedia>
				<EmptyTitle>No devices found</EmptyTitle>
			</EmptyHeader>
		</Empty>
	);
}
