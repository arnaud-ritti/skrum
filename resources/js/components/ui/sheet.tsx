import * as SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"
import * as React from "react"

import { useTrans } from "@/hooks/use-trans"
import { cn } from "@/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-(--duration-slow) data-[state=open]:ease-(--ease-enter) data-[state=closed]:duration-(--duration-base) data-[state=closed]:ease-(--ease-exit) fixed inset-0 z-50 bg-skrum-scrim backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  closeLabel,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  closeLabel?: string
}) {
  const { t } = useTrans()

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-popover text-popover-foreground shadow-modal data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-(--duration-slow) data-[state=open]:ease-(--ease-enter) data-[state=closed]:duration-(--duration-base) data-[state=closed]:ease-(--ease-exit) fixed z-50 flex flex-col gap-0 p-0",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right motion-reduce:data-[state=closed]:slide-out-to-right-0 motion-reduce:data-[state=open]:slide-in-from-right-0 inset-y-0 right-0 h-full w-full border-l sm:max-w-105",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left motion-reduce:data-[state=closed]:slide-out-to-left-0 motion-reduce:data-[state=open]:slide-in-from-left-0 inset-y-0 left-0 h-full w-full border-r sm:max-w-105",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top motion-reduce:data-[state=closed]:slide-out-to-top-0 motion-reduce:data-[state=open]:slide-in-from-top-0 inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom motion-reduce:data-[state=closed]:slide-out-to-bottom-0 motion-reduce:data-[state=open]:slide-in-from-bottom-0 inset-x-0 bottom-0 h-auto border-t",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close-button"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring absolute top-4 right-4 flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-3 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0"
          >
            <XIcon className="size-4" />
            <span className="sr-only">{closeLabel ?? t("Close")}</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 border-b px-6 pt-5 pb-4 pr-14", className)}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex-1 space-y-4 overflow-y-auto px-6 py-5", className)}
      {...props}
    />
  )
}

function SheetProperties({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="sheet-properties"
      className={cn(
        "grid grid-cols-[--spacing(27.5)_1fr] items-center gap-x-3 gap-y-2",
        className
      )}
      {...props}
    />
  )
}

function SheetProperty({
  label,
  icon,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="sheet-property"
      className={cn("col-span-2 grid grid-cols-subgrid items-center", className)}
      {...props}
    >
      <dt className="text-muted-foreground text-body-sm flex min-w-0 items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
        {icon && <span aria-hidden="true">{icon}</span>}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("bg-popover sticky bottom-0 mt-auto flex gap-2 border-t px-6 py-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground text-ui-lg font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-body-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetProperties,
  SheetProperty,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
