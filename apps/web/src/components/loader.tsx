import { Loader2Icon } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = PropsWithChildren & {
  isLoading?: boolean;
  className?: string;
  fallback?: ReactNode;
};

export default function Loader({ isLoading, fallback, ...props }: Props) {
  if (isLoading)
    return fallback ? (
      fallback
    ) : (
      <Loader2Icon className={cn("animate-spin", props.className)} />
    );
  return props.children;
}
