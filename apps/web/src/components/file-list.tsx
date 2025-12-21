import * as React from "react";
import { cn } from "@/lib/utils";

interface FileListProps extends React.HTMLAttributes<HTMLDivElement> {
	orientation?: "horizontal" | "vertical";
	empty?: React.ReactNode;
}

export function FileList({
	className,
	orientation = "vertical",
	empty,
	children,
	...props
}: FileListProps) {
	const hasChildren = React.Children.count(children) > 0;

	if (!hasChildren && empty) {
		return <>{empty}</>;
	}

	return (
		<div
			data-orientation={orientation}
			{...props}
			className={cn(
				"flex gap-2",
				orientation === "vertical" && "flex-col",
				orientation === "horizontal" && "flex-row overflow-x-auto p-1.5",
				className,
			)}
		>
			{children}
		</div>
	);
}
