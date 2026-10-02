import * as TabsPrimitive from "@radix-ui/react-tabs"
import type { LucideIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

type TabsVariant = "pill" | "line"

interface TabsContextValue {
  variant: TabsVariant
  fullWidth: boolean
}

const TabsContext = React.createContext<TabsContextValue>({
  variant: "pill",
  fullWidth: false,
})

export interface TabsItem<T extends string = string> {
  value: T
  label: string
  icon?: LucideIcon
  count?: number
  disabled?: boolean
}

type TabsProps<T extends string = string> = Omit<
  React.ComponentProps<typeof TabsPrimitive.Root>,
  "value" | "onValueChange" | "defaultValue"
> & {
  value?: T
  defaultValue?: T
  onValueChange?: (value: T) => void
  items?: TabsItem<T>[]
  variant?: TabsVariant
  fullWidth?: boolean
  "aria-label"?: string
}

function Tabs<T extends string = string>({
  className,
  items,
  variant = "pill",
  fullWidth = false,
  onValueChange,
  children,
  "aria-label": ariaLabel,
  ...props
}: TabsProps<T>) {
  return (
    <TabsContext.Provider value={{ variant, fullWidth }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn("flex min-w-0 flex-col gap-2", className)}
        onValueChange={onValueChange as ((value: string) => void) | undefined}
        {...props}
      >
        {items ? (
          <TabsList aria-label={ariaLabel}>
            {items.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                disabled={item.disabled}
                icon={item.icon}
                count={item.count}
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const { variant, fullWidth } = React.useContext(TabsContext)

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center overflow-hidden",
        variant === "pill"
          ? "h-9 rounded-lg bg-muted p-0.75"
          : "h-auto gap-4 rounded-none border-b bg-transparent p-0",
        fullWidth ? "flex w-full" : "w-fit",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  children,
  icon: Icon,
  count,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  icon?: LucideIcon
  count?: number
}) {
  const { variant, fullWidth } = React.useContext(TabsContext)

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group/tab inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap text-muted-foreground transition-colors duration-150 ease-out outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground motion-reduce:transition-none",
        variant === "pill"
          ? "h-7.5 rounded-md px-3 text-body-sm font-semibold data-[state=active]:bg-card data-[state=active]:shadow-card"
          : "h-10 rounded-none px-0.5 text-body-sm font-semibold hover:not-data-[state=active]:shadow-[inset_0_-2px_0_var(--border)] data-[state=active]:bg-transparent data-[state=active]:shadow-[inset_0_-2px_0_var(--primary)] focus-visible:ring-inset",
        fullWidth && "flex-1",
        className
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" /> : null}
      <span className="min-w-0 truncate">{children}</span>
      {count === undefined ? null : (
        <>
          <span className="sr-only">, </span>
          <span
            data-slot="tabs-count"
            className="shrink-0 rounded-full bg-muted-foreground/15 px-1.5 text-xs/4.5 font-bold tabular-nums group-data-[state=active]/tab:bg-skrum-primary-soft group-data-[state=active]/tab:text-skrum-primary-text"
          >
            {count}
          </span>
        </>
      )}
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "focus-visible:ring-ring focus-visible:ring-offset-background flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
