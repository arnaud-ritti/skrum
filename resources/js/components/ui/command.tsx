import { Command as CommandPrimitive } from "cmdk"
import { ChevronDownIcon, SearchIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useRestoreFocus } from "@/components/ui/use-restore-focus"
import { matchesShortcut, useShortcut } from "@/hooks/use-shortcut"
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
  title,
  description,
  children,
  className,
  commandProps,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  commandProps?: React.ComponentProps<typeof CommandPrimitive>
}) {
  const { t } = useTrans()
  const restoreFocus = useRestoreFocus(props.open ?? false)

  return (
    <Dialog {...props}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={restoreFocus}
        className={cn(
          "shadow-modal top-1/5 translate-y-0 gap-0 overflow-hidden rounded-xl p-0 sm:max-w-140",
          className
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title ?? t("Command palette")}</DialogTitle>
          <DialogDescription>
            {description ?? t("Search, run an action or open a session")}
          </DialogDescription>
        </DialogHeader>
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
      className="focus-within:ring-ring flex h-12 items-center gap-2 border-b px-3.5 focus-within:ring-2 focus-within:ring-inset"
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

/**
 * cmdk gives its list an id of its own and drops the one passed in: a trigger
 * reads that id here, through the ref, to point `aria-controls` at the list.
 */
function useCommandListId(): [
  string | undefined,
  (list: HTMLDivElement | null) => void,
] {
  const [listId, setListId] = React.useState<string>()
  const listRef = React.useCallback(
    (list: HTMLDivElement | null) => setListId(list?.id),
    []
  )

  return [listId, listRef]
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
  group: "actions" | "recent" | "results" | "goto"
  label: string
  icon: LucideIcon
  meta?: string
  /** A status beside the label, such as "Live" on a session in progress. */
  badge?: string
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
  /** True while the items of the group "results" are being fetched. */
  loading?: boolean
  /** Told what is typed, and an empty query when the palette closes. */
  onSearchChange?: (value: string) => void
  /**
   * mod+K opens and closes the palette; off where a page gives mod+K to its
   * own field.
   */
  toggleShortcut?: boolean
}

const paletteGroups = ["actions", "recent", "results", "goto"] as const

type PaletteGroup = (typeof paletteGroups)[number]

/** Items of a group shown before "Show more" (Command README). */
const GroupLimit = 5

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

  let normalized = ""
  const rawIndexes: number[] = []
  let rawIndex = 0

  for (const character of label) {
    const piece = normalize(character)

    rawIndexes.push(...Array.from(piece, () => rawIndex))
    normalized += piece
    rawIndex += character.length
  }

  rawIndexes.push(label.length)

  const normalizedStart = normalized.indexOf(query)

  if (normalizedStart === -1) {
    return <>{label}</>
  }

  const start = rawIndexes[normalizedStart]
  const end = rawIndexes[normalizedStart + query.length]

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

/**
 * `mod+K` and `/` open the palette, except from a field being edited and,
 * for `/`, while another dialog or menu is open. The palette closes on
 * `mod+K` from its own field (see `CommandPalette`).
 */
function useCommandPaletteShortcut(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  toggleShortcut: boolean
): void {
  useShortcut("mod+k", () => onOpenChange(!open), {
    enabled: toggleShortcut,
    enableInOverlays: true,
  })
  useShortcut("/", () => onOpenChange(true), { enabled: !open })
}

function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder,
  emptyText,
  loading = false,
  onSearchChange,
  toggleShortcut = true,
}: CommandPaletteProps) {
  const { t } = useTrans()
  const [search, setSearch] = React.useState("")
  const [expanded, setExpanded] = React.useState<PaletteGroup[]>([])
  const reportSearch = React.useRef(onSearchChange)

  useCommandPaletteShortcut(open, onOpenChange, toggleShortcut)

  React.useEffect(() => {
    reportSearch.current = onSearchChange
  })

  React.useEffect(() => {
    if (!open) {
      setSearch("")
    }
  }, [open])

  React.useEffect(() => {
    setExpanded([])
    reportSearch.current?.(search)
  }, [search])

  const query = normalize(search.trim())
  const visible = items.filter(
    (item) => matches(item, query) && !(loading && item.group === "results")
  )
  const headings = {
    actions: t("Actions"),
    recent: t("Recent sessions"),
    results: t("Results"),
    goto: t("Go to"),
  }

  const closeFromOwnField = (event: React.KeyboardEvent): void => {
    if (!matchesShortcut(event.nativeEvent, "mod+k")) {
      return
    }

    event.preventDefault()
    onOpenChange(false)
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
      commandProps={{
        shouldFilter: false,
        loop: true,
        onKeyDown: closeFromOwnField,
      }}
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={placeholder ?? t("Search or run a command...")}
      />
      <CommandList>
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
        {paletteGroups.map((group) => {
          if (group === "results" && loading) {
            return (
              <CommandLoading
                key={group}
                label={t("Searching...")}
                className="flex items-center justify-center gap-2"
              >
                <Spinner aria-label={t("Loading")} className="size-4" />
                {t("Searching...")}
              </CommandLoading>
            )
          }

          const groupItems = visible.filter((item) => item.group === group)

          if (groupItems.length === 0) {
            return null
          }

          const isFolded =
            groupItems.length > GroupLimit && !expanded.includes(group)
          const shown = isFolded ? groupItems.slice(0, GroupLimit) : groupItems

          return (
            <CommandGroup key={group} heading={headings[group]}>
              {shown.map((item) => (
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
                  {item.badge && (
                    <Badge variant="success">
                      <span
                        aria-hidden="true"
                        className="bg-skrum-success size-2 shrink-0 rounded-full"
                      />
                      {item.badge}
                    </Badge>
                  )}
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
              {isFolded && (
                <CommandItem
                  value={`__more:${group}`}
                  onSelect={() => setExpanded([...expanded, group])}
                  className="text-muted-foreground"
                >
                  <CommandItemIcon>
                    <ChevronDownIcon />
                  </CommandItemIcon>
                  <span className="min-w-0 flex-1 truncate">
                    {t("Show :count more", {
                      count: groupItems.length - GroupLimit,
                    })}
                  </span>
                </CommandItem>
              )}
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
            : visible.length === 1
              ? t(":count result", { count: visible.length })
              : t(":count results", { count: visible.length })}
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
  useCommandListId,
}
