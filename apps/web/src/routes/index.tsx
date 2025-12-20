import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { ShareForm } from "@/components/share-form";

const roomSchema = z.object({
	roomId: z.string().optional(),
});

export const Route = createFileRoute("/")({
	validateSearch: roomSchema,
	component: HomeComponent,
});

function HomeComponent() {
	const { roomId } = Route.useSearch();

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-lg">
				<ShareForm roomId={roomId} />
			</div>
		</div>
	);
}
