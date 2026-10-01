import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useTrans } from "@/hooks/use-trans"
import { cn } from "@/lib/utils"

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command palette",
  description = "Search for a command to run",
  children,
  className,
  commandProps,
  closeLabel,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  closeLabel?: string
  commandProps?: React.ComponentProps<typeof CommandPrimitive>
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        showCloseButton={false}
        closeLabel={closeLabel}
        className={cn(
          "shadow-modal top-1/5 translate-y-0 gap-0 overflow-hidden rounded-xl p-0 sm:max-w-140",
          className
        )}
      >
        <Command
          {...commandProps}
          className={cn(
            "[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold",
            commandProps?.className
          )}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-12 items-center gap-2 border-b px-3.5"
    >
      <SearchIcon aria-hidden="true" className="size-4 shrink-0 opacity-60" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "text-ui-lg placeholder:text-muted-foreground flex h-12 w-full bg-transparent outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      <kbd
        aria-hidden="true"
        className="text-muted-foreground bg-muted rounded-sm border px-1.5 font-mono text-xs"
      >
        Esc
      </kbd>
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-80 scroll-py-1 overflow-x-hidden overflow-y-auto p-1",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("text-muted-foreground py-6 text-center text-sm", className)}
      {...props}
    />
  )
}

function CommandLoading({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Loading>) {
  return (
    <CommandPrimitive.Loading
      data-slot="command-loading"
      className={cn("text-muted-foreground py-6 text-center text-sm", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("bg-border -mx-1 h-px", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex h-9 cursor-default items-center gap-2 rounded-sm px-2 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function CommandItemIcon({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-item-icon"
      aria-hidden="true"
      className={cn(
        "bg-muted group-data-[selected=true]:bg-card flex size-6 shrink-0 items-center justify-center rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    />
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "text-muted-foreground ml-auto flex shrink-0 items-center gap-1 text-xs",
        className
      )}
      {...props}
    />
  )
}

function CommandKbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="command-kbd"
      className={cn(
        "bg-muted text-muted-foreground min-w-5 rounded-sm border px-1 text-center font-mono text-xs",
        className
      )}
      {...props}
    />
  )
}

function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-footer"
      className={cn(
        "bg-muted text-muted-foreground flex items-center gap-4 border-t px-3.5 py-2 text-xs",
        className
      )}
      {...props}
    />
  )
}

export interface CommandPaletteItem {
  id: string
  group: "actions" | "recent" | "goto"
  label: string
  icon: LucideIcon
  meta?: string
  shortcut?: string[]
  keywords?: string[]
  onSelect: () => void
}

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CommandPaletteItem[]
  placeholder?: string
  emptyText?: string
  loading?: boolean
}

const paletteGroups = ["actions", "recent", "goto"] as const

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function matches(item: CommandPaletteItem, query: string): boolean {
  if (query === "") {
    return true
  }

  const haystack = normalize([item.label, ...(item.keywords ?? [])].join(" "))

  return haystack.includes(query)
}

function HighlightedLabel({ label, query }: { label: string; query: string }) {
  if (query === "") {
    return <>{label}</>
  }

  const start = normalize(label).indexOf(query)

  if (start === -1) {
    return <>{label}</>
  }

  const end = start + query.length

  return (
    <>
      {label.slice(0, start)}
      <strong data-slot="command-match" className="font-bold">
        {label.slice(start, end)}
      </strong>
      {label.slice(end)}
    </>
  )
}

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  )
}

function useCommandPaletteShortcut(
  open: boolean,
  onOpenChange: (open: boolean) => void
): void {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)

        return
      }

      if (event.key === "/" && !open && !isEditingTarget(event.target)) {
        event.preventDefault()
        onOpenChange(true)
      }
    }

    document.addEventListener("keydown", onKeyDown)

    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])
}

function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder,
  emptyText,
  loading = false,
}: CommandPaletteProps) {
  const { t } = useTrans()
  const [search, setSearch] = React.useState("")

  useCommandPaletteShortcut(open, onOpenChange)

  React.useEffect(() => {
    if (!open) {
      setSearch("")
    }
  }, [open])

  const query = normalize(search.trim())
  const visible = items.filter((item) => matches(item, query))
  const headings = {
    actions: t("Actions"),
    recent: t("Recent sessions"),
    goto: t("Go to"),
  }

  const select = (item: CommandPaletteItem) => {
    onOpenChange(false)
    item.onSelect()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("Command palette")}
      description={t("Search, run an action or open a session")}
      commandProps={{ shouldFilter: false, loop: true }}
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={placeholder ?? t("Search or run a command...")}
      />
      <CommandList>
        {loading && (
          <CommandLoading label={t("Searching...")} className="flex items-center justify-center gap-2">
            <Spinner aria-label={t("Loading")} className="size-4" />
            {t("Searching...")}
          </CommandLoading>
        )}
        {!loading && visible.length === 0 && (
          <div
            data-slot="command-empty"
            className="text-muted-foreground flex flex-col gap-1 py-6 text-center text-sm"
          >
            <span>
              {emptyText ??
                (search.trim() === ""
                  ? t("Nothing to show yet.")
                  : t("No results for “:query”", { query: search.trim() }))}
            </span>
            <span className="text-xs">{t("Try a shorter or different word.")}</span>
          </div>
        )}
        {!loading &&
          paletteGroups.map((group) => {
            const groupItems = visible.filter((item) => item.group === group)

            if (groupItems.length === 0) {
              return null
            }

            return (
              <CommandGroup key={group} heading={headings[group]}>
                {groupItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => select(item)}
                  >
                    <CommandItemIcon>
                      <item.icon />
                    </CommandItemIcon>
                    <span className="min-w-0 flex-1 truncate">
                      <HighlightedLabel label={item.label} query={query} />
                    </span>
                    {item.meta && (
                      <span className="text-muted-foreground max-w-40 shrink-0 truncate text-xs">
                        {item.meta}
                      </span>
                    )}
                    {item.shortcut && item.shortcut.length > 0 && (
                      <CommandShortcut className="ml-0">
                        {item.shortcut.map((key, index) => (
                          <CommandKbd key={`${key}-${index}`}>{key}</CommandKbd>
                        ))}
                      </CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
      </CommandList>
      <CommandFooter>
        <span className="inline-flex items-center gap-1.5">
          <CommandKbd>↑</CommandKbd>
          <CommandKbd>↓</CommandKbd>
          {t("navigate")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CommandKbd>↵</CommandKbd>
          {t("open")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CommandKbd>Esc</CommandKbd>
          {t("close")}
        </span>
        <span aria-live="polite" className="ml-auto truncate">
          {loading
            ? ""
            : t(visible.length === 1 ? ":count result" : ":count results", {
                count: visible.length,
              })}
        </span>
      </CommandFooter>
    </CommandDialog>
  )
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandKbd,
  CommandPalette,
  CommandList,
  CommandLoading,
  CommandSeparator,
  CommandShortcut,
  useCommandPaletteShortcut,
}
