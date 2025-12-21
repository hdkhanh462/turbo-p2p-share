import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { cn } from "@/lib/utils";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
	progress: number;
	variant?: "linear" | "circular" | "fill";
	size?: number;
	asChild?: boolean;
	forceMount?: boolean;
}

export function FileItemProgress(props: Props) {
	const {
		progress,
		variant = "linear",
		size = 40,
		asChild,
		forceMount,
		className,
		...rest
	} = props;

	const clampedProgress = Math.min(100, Math.max(0, progress));
	const shouldRender = forceMount || clampedProgress !== 100;

	if (!shouldRender) return null;

	const ItemProgressPrimitive = asChild ? Slot : "div";

	switch (variant) {
		case "circular": {
			const circumference = 2 * Math.PI * ((size - 4) / 2);
			const strokeDashoffset =
				circumference - (clampedProgress / 100) * circumference;

			return (
				<ItemProgressPrimitive
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={clampedProgress}
					aria-valuetext={`${clampedProgress}%`}
					data-slot="file-download-progress"
					{...rest}
					className={cn(
						"absolute inset-1/2 -translate-x-1/2 -translate-y-1/2",
						className,
					)}
				>
					<svg
						className="-rotate-90 transform"
						width={size}
						height={size}
						viewBox={`0 0 ${size} ${size}`}
						fill="none"
						stroke="currentColor"
					>
						<title>FileDownloadItemProgress</title>
						<circle
							className="text-primary/20"
							strokeWidth="2"
							cx={size / 2}
							cy={size / 2}
							r={(size - 4) / 2}
						/>
						<circle
							className="text-primary transition-[stroke-dashoffset] duration-300 ease-linear"
							strokeWidth="2"
							strokeLinecap="round"
							strokeDasharray={circumference}
							strokeDashoffset={strokeDashoffset}
							cx={size / 2}
							cy={size / 2}
							r={(size - 4) / 2}
						/>
					</svg>
				</ItemProgressPrimitive>
			);
		}

		case "fill": {
			const topInset = 100 - clampedProgress;

			return (
				<ItemProgressPrimitive
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={clampedProgress}
					aria-valuetext={`${clampedProgress}%`}
					data-slot="file-download-progress"
					{...rest}
					className={cn(
						"absolute inset-0 bg-primary/50 transition-[clip-path] duration-300 ease-linear",
						className,
					)}
					style={{
						clipPath: `inset(${topInset}% 0% 0% 0%)`,
					}}
				/>
			);
		}

		default:
			return (
				<ItemProgressPrimitive
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={clampedProgress}
					aria-valuetext={`${clampedProgress}%`}
					data-slot="file-download-progress"
					{...rest}
					className={cn(
						"relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20",
						className,
					)}
				>
					<div
						className="h-full w-full bg-primary transition-transform duration-300 ease-linear"
						style={{
							transform: `translateX(-${100 - clampedProgress}%)`,
						}}
					/>
				</ItemProgressPrimitive>
			);
	}
}
