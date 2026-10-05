import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import {
  CheckIcon,
  ChevronRightIcon,
  CircleIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import * as React from "react"

import { useTrans } from "@/hooks/use-trans"
import { cn } from "@/lib/utils"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

type DropdownMenuSize = "default" | "wide"

function DropdownMenuContent({
  className,
  sideOffset = 4,
  collisionPadding = 8,
  size = "default",
  portalled = true,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  size?: DropdownMenuSize
  portalled?: boolean
}) {
  const Wrapper = portalled ? DropdownMenuPrimitive.Portal : React.Fragment

  return (
    <Wrapper>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        data-size={size}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 duration-(--duration-base) ease-(--ease-enter) motion-reduce:animate-none z-50 min-w-32 overflow-hidden rounded-lg border p-1 shadow-popover data-[size=wide]:min-w-55",
          className
        )}
        {...props}
      />
    </Wrapper>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[variant=destructive]:text-skrum-destructive-text data-[variant=destructive]:data-[highlighted]:bg-skrum-destructive-soft data-[variant=destructive]:data-[highlighted]:text-skrum-destructive-text data-[variant=destructive]:[&_svg]:text-current [&_svg:not([class*='text-'])]:text-muted-foreground relative flex min-h-8 cursor-default items-center py-1.5 gap-2 rounded-sm px-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex min-h-8 cursor-default items-center py-1.5 gap-2 rounded-sm pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex min-h-8 cursor-default items-center py-1.5 gap-2 rounded-sm pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
  variant?: "default" | "overline"
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "px-2 py-1.5 data-[inset]:pl-8",
        variant === "overline"
          ? "text-muted-foreground text-xs font-semibold"
          : "text-foreground text-sm font-medium",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto pl-4 text-xs tracking-widest",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex min-h-8 cursor-default items-center py-1.5 gap-2 rounded-sm px-2 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="text-muted-foreground ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  collisionPadding = 8,
  size = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent> & {
  size?: DropdownMenuSize
}) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      data-size={size}
      collisionPadding={collisionPadding}
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 duration-(--duration-base) ease-(--ease-enter) motion-reduce:animate-none z-50 min-w-32 overflow-hidden rounded-lg border p-1 shadow-popover data-[size=wide]:min-w-55",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuInlineFrame({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-inline-frame"
      className={cn(
        "flex flex-col items-start gap-1 [&>[data-radix-popper-content-wrapper]]:static! [&>[data-radix-popper-content-wrapper]]:transform-none!",
        className
      )}
      {...props}
    />
  )
}

type MenuEntry =
  | {
      type: "item"
      label: string
      icon?: LucideIcon
      shortcut?: string
      onSelect: () => void
      disabled?: boolean
      disabledReason?: string
      tone?: "default" | "danger"
    }
  | { type: "sub"; label: string; icon?: LucideIcon; items: MenuEntry[] }
  | {
      type: "checkbox"
      label: string
      checked: boolean
      onCheckedChange: (value: boolean) => void
    }
  | {
      type: "radio"
      /** Names the group of radios for assistive technology. */
      label?: string
      value: string
      items: { value: string; label: string }[]
      onValueChange: (value: string) => void
    }
  | { type: "separator" }
  | { type: "label"; label: string }

interface CardMenuProps {
  trigger: React.ReactNode
  entries: MenuEntry[]
  align?: "start" | "end"
  label?: string
  defaultOpen?: boolean
  /**
   * Renders the menu open in the document flow, under its trigger, instead of
   * a floating layer: for previews where several menus must be visible at once.
   */
  inline?: boolean
}

function CardMenuEntries({ entries }: { entries: MenuEntry[] }) {
  return entries.map((entry, index) => {
    if (entry.type === "separator") {
      return <DropdownMenuSeparator key={index} />
    }

    if (entry.type === "label") {
      return (
        <DropdownMenuLabel key={index} variant="overline">
          {entry.label}
        </DropdownMenuLabel>
      )
    }

    if (entry.type === "checkbox") {
      return (
        <DropdownMenuCheckboxItem
          key={index}
          checked={entry.checked}
          onCheckedChange={entry.onCheckedChange}
        >
          <span className="truncate">{entry.label}</span>
        </DropdownMenuCheckboxItem>
      )
    }

    if (entry.type === "radio") {
      return (
        <DropdownMenuRadioGroup
          key={index}
          aria-label={entry.label}
          value={entry.value}
          onValueChange={entry.onValueChange}
        >
          {entry.items.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              <span className="truncate">{item.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      )
    }

    if (entry.type === "sub") {
      const Icon = entry.icon

      return (
        <DropdownMenuSub key={index}>
          <DropdownMenuSubTrigger>
            {Icon ? <Icon aria-hidden /> : null}
            <span className="truncate">{entry.label}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent size="wide">
            <CardMenuEntries entries={entry.items} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    const isDanger = entry.tone === "danger"
    const Icon = entry.icon ?? (isDanger ? Trash2Icon : undefined)
    const reason = entry.disabled ? entry.disabledReason : undefined
    const trailing = reason ?? entry.shortcut
    // A disabled item with a reason stays reachable, so the reason is heard.
    const isExplained = reason !== undefined

    return (
      <DropdownMenuItem
        key={index}
        variant={isDanger ? "destructive" : "default"}
        disabled={entry.disabled && !isExplained}
        aria-disabled={isExplained ? true : undefined}
        data-disabled={isExplained ? "" : undefined}
        onSelect={(event) => {
          if (entry.disabled) {
            event.preventDefault()

            return
          }

          entry.onSelect()
        }}
      >
        {Icon ? <Icon aria-hidden /> : null}
        <span className="truncate">{entry.label}</span>
        {trailing ? (
          <DropdownMenuShortcut
            data-kind={reason ? "reason" : "shortcut"}
            className={cn(
              "truncate",
              reason && "tracking-normal",
              isDanger && "text-current opacity-80"
            )}
          >
            {trailing}
          </DropdownMenuShortcut>
        ) : null}
      </DropdownMenuItem>
    )
  })
}

function CardMenu({
  trigger,
  entries,
  align = "end",
  label,
  defaultOpen,
  inline = false,
}: CardMenuProps) {
  const { t } = useTrans()

  if (inline) {
    return (
      <DropdownMenuInlineFrame>
        <DropdownMenu open modal={false}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent
            portalled={false}
            size="wide"
            align={align}
            aria-label={label ?? t("Actions")}
            className="animate-none!"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <CardMenuEntries entries={entries} />
          </DropdownMenuContent>
        </DropdownMenu>
      </DropdownMenuInlineFrame>
    )
  }

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        size="wide"
        align={align}
        aria-label={label ?? t("Actions")}
      >
        <CardMenuEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export type { CardMenuProps, MenuEntry }

export {
  CardMenu,
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuInlineFrame,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
