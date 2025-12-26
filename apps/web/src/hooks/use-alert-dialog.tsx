import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Button } from "@/components/ui/button";

export type AlertDialogOptions = {
	title: string;
	description?: string;
	cancel?: {
		label?: string;
		props?: Parameters<typeof Button>[0];
	};
	action?: {
		label?: string;
		props?: Parameters<typeof Button>[0];
	};
};

type AlertDialogContextType = {
	open: boolean;
	alert: (options: AlertDialogOptions) => Promise<boolean>;
	close: () => void;
};

const AlertDialogContext = createContext<AlertDialogContextType | null>(null);

export function AlertDialogProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [options, setOptions] = useState<AlertDialogOptions | null>(null);
	const [resolver, setResolver] = useState<((value: boolean) => void) | null>(
		null,
	);

	const alert = useCallback((options: AlertDialogOptions) => {
		setOptions(options);
		setOpen(true);

		return new Promise<boolean>((resolve) => {
			setResolver(() => resolve);
		});
	}, []);

	const close = useCallback(() => {
		setOpen(false);
		setOptions(null);
	}, []);

	const handleClose = (result: boolean) => {
		setOpen(false);
		resolver?.(result);

		setResolver(null);
		setOptions(null);
	};

	return (
		<AlertDialogContext.Provider value={{ open, alert, close }}>
			{children}

			{options && (
				<AlertDialog open={open} onOpenChange={setOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{options.title}</AlertDialogTitle>
							{options.description && (
								<AlertDialogDescription>
									{options.description}
								</AlertDialogDescription>
							)}
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel
								{...options.cancel?.props}
								onClick={() => handleClose(false)}
							>
								{options.cancel?.label ?? "Cancel"}
							</AlertDialogCancel>
							<AlertDialogAction
								{...options.action?.props}
								onClick={() => handleClose(true)}
							>
								{options.action?.label ?? "Continue"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</AlertDialogContext.Provider>
	);
}

export function useAlertDialog() {
	const context = useContext(AlertDialogContext);

	if (!context) {
		throw new Error("useAlertDialog must be used within AlertDialogProvider");
	}

	return context;
}
