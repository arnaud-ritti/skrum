import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { UserRound } from "lucide-react"
import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getInitials } from "@/lib/initials"
import { useTrans } from "@/hooks/use-trans"
import { cn } from "@/lib/utils"

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl"
type AvatarPresence = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
type AvatarStatus = "online" | "away"
type AvatarKind = "member" | "guest" | "anonymous"

const sizeClasses: Record<AvatarSize, string> = {
  xs: "size-5",
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
  xl: "size-14",
}

const initialsClasses: Record<AvatarSize, string> = {
  xs: "text-overline tracking-normal",
  sm: "text-overline tracking-normal",
  md: "text-xs",
  lg: "text-body-sm",
  xl: "text-ui-lg",
}

const iconClasses: Record<AvatarSize, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-7",
}

const presenceFallbackClasses: Record<AvatarPresence, string> = {
  1: "bg-skrum-presence-1 text-skrum-presence-1-foreground",
  2: "bg-skrum-presence-2 text-skrum-presence-2-foreground",
  3: "bg-skrum-presence-3 text-skrum-presence-3-foreground",
  4: "bg-skrum-presence-4 text-skrum-presence-4-foreground",
  5: "bg-skrum-presence-5 text-skrum-presence-5-foreground",
  6: "bg-skrum-presence-6 text-skrum-presence-6-foreground",
  7: "bg-skrum-presence-7 text-skrum-presence-7-foreground",
  8: "bg-skrum-presence-8 text-skrum-presence-8-foreground",
  9: "bg-skrum-presence-9 text-skrum-presence-9-foreground",
  10: "bg-skrum-presence-10 text-skrum-presence-10-foreground",
  11: "bg-skrum-presence-11 text-skrum-presence-11-foreground",
  12: "bg-skrum-presence-12 text-skrum-presence-12-foreground",
}

const presenceRingClasses: Record<AvatarPresence, string> = {
  1: "ring-skrum-presence-1 text-skrum-presence-1",
  2: "ring-skrum-presence-2 text-skrum-presence-2",
  3: "ring-skrum-presence-3 text-skrum-presence-3",
  4: "ring-skrum-presence-4 text-skrum-presence-4",
  5: "ring-skrum-presence-5 text-skrum-presence-5",
  6: "ring-skrum-presence-6 text-skrum-presence-6",
  7: "ring-skrum-presence-7 text-skrum-presence-7",
  8: "ring-skrum-presence-8 text-skrum-presence-8",
  9: "ring-skrum-presence-9 text-skrum-presence-9",
  10: "ring-skrum-presence-10 text-skrum-presence-10",
  11: "ring-skrum-presence-11 text-skrum-presence-11",
  12: "ring-skrum-presence-12 text-skrum-presence-12",
}

function Avatar({
  className,
  size,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: AvatarSize
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        size ? sizeClasses[size] : "size-8",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  presence,
  size,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback> & {
  presence?: AvatarPresence
  size?: AvatarSize
}) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        presence && "font-bold",
        presence && presenceFallbackClasses[presence],
        size && initialsClasses[size],
        className
      )}
      {...props}
    />
  )
}

interface PersonAvatarProps extends Omit<
  React.ComponentProps<"span">,
  "children"
> {
  name: string
  presence?: AvatarPresence
  src?: string | null
  size?: AvatarSize
  status?: AvatarStatus
  typing?: boolean
  kind?: AvatarKind
  decorative?: boolean
  /**
   * Attributes of the image (`alt`, `data-*`, `onError`…). When given, the
   * image is a plain `<img>` mounted at once over the fallback, for guests
   * too, and it is removed when it fails to load.
   */
  imgProps?: Omit<React.ComponentProps<"img">, "src"> & {
    [attribute: `data-${string}`]: string | undefined
  }
}

function PersonAvatar({
  name,
  presence,
  src,
  size = "md",
  status,
  typing = false,
  kind = "member",
  decorative = false,
  imgProps,
  className,
  ...props
}: PersonAvatarProps) {
  const { t } = useTrans()
  const [imageStatus, setImageStatus] = React.useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle")

  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)

  const isMember = kind === "member"
  const hasPlainImage =
    imgProps !== undefined &&
    Boolean(src) &&
    kind !== "anonymous" &&
    failedSrc !== src
  const initials = getInitials(name) || "?"
  const memberPresence = isMember ? presence : undefined
  const isLoadingImage = Boolean(src) && imageStatus === "loading"

  const labels: Record<AvatarKind, string> = {
    member: name,
    guest: `${name} (${t("Guest")})`,
    anonymous: t("Anonymous"),
  }
  const label = labels[kind]
  const details = [
    status === "online" ? t("online") : null,
    status === "away" ? t("away") : null,
    typing ? t("writing") : null,
  ].filter(Boolean)
  const accessibleName =
    details.length > 0
      ? t(":name, :status", { name: label, status: details.join(", ") })
      : label

  const avatar = (
    <span
      data-slot="person-avatar"
      data-kind={kind}
      data-status={status}
      data-typing={typing ? "true" : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : accessibleName}
      aria-hidden={decorative ? true : undefined}
      className={cn("relative inline-flex shrink-0 rounded-full", className)}
      {...props}
    >
      <Avatar
        size={size}
        aria-hidden
        className={cn(
          typing &&
            "ring-2 ring-offset-2 ring-offset-card " +
              (memberPresence
                ? presenceRingClasses[memberPresence]
                : "ring-primary text-primary"),
          !isMember && "border border-input bg-card"
        )}
      >
        {hasPlainImage && (
          <img
            alt=""
            {...imgProps}
            src={src ?? undefined}
            data-slot="avatar-image"
            onError={(event) => {
              setFailedSrc(src ?? null)
              imgProps?.onError?.(event)
            }}
            className={cn(
              "bg-muted absolute inset-0 z-10 size-full rounded-full object-cover",
              imgProps?.className
            )}
          />
        )}
        {imgProps === undefined && isMember && src && (
          <AvatarImage
            src={src}
            alt=""
            onLoadingStatusChange={setImageStatus}
          />
        )}
        <AvatarFallback
          presence={memberPresence}
          size={size}
          className={cn(
            isLoadingImage && "animate-pulse",
            isMember && !presence && "text-muted-foreground font-bold",
            !isMember && "bg-card text-muted-foreground font-bold"
          )}
        >
          {kind === "guest" && (
            <UserRound className={iconClasses[size]} aria-hidden />
          )}
          {kind === "anonymous" && "?"}
          {isMember && initials}
        </AvatarFallback>
      </Avatar>
      {typing && (
        <span
          data-slot="avatar-typing"
          aria-hidden
          className={cn(
            "bg-card absolute -top-1 -right-1 flex items-center gap-px rounded-full px-0.5 py-px",
            memberPresence ? presenceRingClasses[memberPresence] : "text-primary"
          )}
        >
          <i className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none" />
          <i className="size-1 animate-trema rounded-full bg-current [animation-delay:180ms] motion-reduce:animate-none" />
        </span>
      )}
      {status && (
        <span
          data-slot="avatar-status"
          aria-hidden
          className={cn(
            "ring-card absolute -right-px -bottom-px size-2.5 rounded-full ring-2",
            status === "online" ? "bg-skrum-success" : "bg-muted-foreground"
          )}
        />
      )}
    </span>
  )

  if (decorative || details.length === 0) {
    return avatar
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{avatar}</TooltipTrigger>
        <TooltipContent>{accessibleName}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { Avatar, AvatarImage, AvatarFallback, PersonAvatar }
export type {
  AvatarSize,
  AvatarPresence,
  AvatarStatus,
  AvatarKind,
  PersonAvatarProps,
}
