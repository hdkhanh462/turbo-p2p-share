import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AlertDialogProvider } from "@/hooks/use-alert-dialog";
import { E2EEncryptionProvider } from "@/hooks/use-e2e-encryption";
import { SocketProvider } from "@/hooks/use-socket";

import "../index.css";

export const Route = createRootRouteWithContext()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "turbo-p2p-share",
			},
			{
				name: "description",
				content: "turbo-p2p-share is a web application",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<SocketProvider>
					<E2EEncryptionProvider>
						<AlertDialogProvider>
							<Outlet />
						</AlertDialogProvider>
					</E2EEncryptionProvider>
				</SocketProvider>
				<Toaster richColors />
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
		</>
	);
}
