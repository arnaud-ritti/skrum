import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

type AccordionVariant = "plain" | "card"

const AccordionVariantContext = React.createContext<AccordionVariant>("plain")

interface AccordionItemDef {
  value: string
  title: string
  summary?: string
  icon?: LucideIcon
  disabled?: boolean
  content: React.ReactNode
}

type AccordionItemsProps =
  | {
      type: "single"
      collapsible?: boolean
      value?: string
      defaultValue?: string
      onValueChange?: (value: string) => void
    }
  | {
      type: "multiple"
      value?: string[]
      defaultValue?: string[]
      onValueChange?: (value: string[]) => void
    }

type AccordionRootProps = React.ComponentProps<typeof AccordionPrimitive.Root>

type AccordionProps = (AccordionRootProps | (AccordionItemsProps & { items: AccordionItemDef[] })) & {
  variant?: AccordionVariant
  className?: string
}

function Accordion({ variant = "plain", className, ...props }: AccordionProps) {
  const { items, ...rootProps } = props as AccordionRootProps & {
    items?: AccordionItemDef[]
  }

  return (
    <AccordionVariantContext.Provider value={variant}>
      <AccordionPrimitive.Root
        data-slot="accordion"
        data-variant={variant}
        className={cn(
          variant === "card" && "rounded-lg border bg-card shadow-card",
          className
        )}
        {...(rootProps as AccordionRootProps)}
      >
        {items?.map((item) => (
          <AccordionItem
            key={item.value}
            value={item.value}
            disabled={item.disabled}
          >
            <AccordionTrigger icon={item.icon} summary={item.summary}>
              {item.title}
            </AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </AccordionPrimitive.Root>
    </AccordionVariantContext.Provider>
  )
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  icon: Icon,
  summary,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  icon?: LucideIcon
  summary?: string
}) {
  const variant = React.useContext(AccordionVariantContext)
  const isCard = variant === "card"

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group flex flex-1 items-start gap-3 py-4 text-left text-sm font-semibold outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          isCard &&
            "m-1 w-auto flex-none grow rounded-md px-3 py-2 hover:bg-muted disabled:hover:bg-transparent",
          className
        )}
        {...props}
      >
        {Icon && (
          <span
            data-slot="accordion-icon"
            className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground group-data-[state=open]:bg-skrum-primary-soft group-data-[state=open]:text-skrum-primary-text"
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
        <span
          className={cn(
            "min-w-0 flex-1 text-balance underline-offset-3 group-hover:underline group-disabled:no-underline",
            Icon ? "leading-7" : "leading-5",
            isCard && "group-hover:no-underline"
          )}
        >
          {children}
        </span>
        {summary && (
          <span
            data-slot="accordion-summary"
            className={cn(
              "max-w-1/2 shrink-0 truncate text-xs font-medium text-muted-foreground",
              Icon ? "leading-7" : "leading-5"
            )}
          >
            {summary}
          </span>
        )}
        <ChevronDown
          data-slot="accordion-chevron"
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-base ease-standard group-data-[state=open]:rotate-180",
            Icon ? "mt-1.5" : "mt-0.5"
          )}
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  const variant = React.useContext(AccordionVariantContext)

  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm/snug text-muted-foreground [--tw-animation-duration:var(--duration-base)] [--tw-ease:var(--ease-standard)] data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div
        className={cn(
          variant === "card" ? "px-4 pt-1 pb-4 text-foreground" : "pb-4",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  )
}

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  type AccordionItemDef,
  type AccordionProps,
  type AccordionVariant,
}
