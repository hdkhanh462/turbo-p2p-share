import type { ComponentProps, HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "sender" | "receiver"
}

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end justify-end gap-2 py-2",
      from === "sender" ? "is-sender" : "is-is-receiver justify-start",
      className
    )}
    {...props}
  />
)

const messageContentVariants = cva(
  "is-sender:dark flex justify-center flex-col gap-2 overflow-hidden rounded-lg text-sm wrap-break-word",
  {
    variants: {
      variant: {
        contained: [
          "max-w-[80%] px-2.5 min-h-8 py-1.5",
          "group-[.is-sender]:bg-primary group-[.is-sender]:text-primary-foreground",
          "group-[.is-is-receiver]:bg-secondary group-[.is-is-receiver]:text-foreground",
        ],
        flat: [
          "group-[.is-sender]:max-w-[80%] group-[.is-sender]:bg-secondary group-[.is-sender]:px-4 group-[.is-sender]:py-3 group-[.is-sender]:text-foreground",
          "group-[.is-is-receiver]:text-foreground",
        ],
      },
    },
    defaultVariants: {
      variant: "contained",
    },
  }
)

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants>

export const MessageContent = ({
  children,
  className,
  variant,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(messageContentVariants({ variant, className }))}
    {...props}
  >
    {children}
  </div>
)

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string
  name?: string
}

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn("ring-border size-8 ring-1", className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
  </Avatar>
)
