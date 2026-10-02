import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { ChevronDown } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type * as React from "react"

import { Button } from "@/components/ui/button"

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

interface CollapsibleBlockProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  trigger: { icon?: LucideIcon; label: string; count?: number }
  children: React.ReactNode
}

function CollapsibleBlock({
  trigger,
  children,
  ...rootProps
}: CollapsibleBlockProps) {
  const { icon: Icon, label, count } = trigger

  return (
    <Collapsible {...rootProps}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group -ml-2 h-8 max-w-full gap-1.5 text-sm text-muted-foreground"
        >
          {Icon && <Icon aria-hidden="true" />}
          <span className="truncate">
            {count === undefined ? label : `${label} (${count})`}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="transition-transform duration-220 ease-standard group-data-[state=open]:rotate-180"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden [--tw-animation-duration:var(--duration-base)] [--tw-ease:var(--ease-standard)] data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="mt-2 rounded-lg border bg-background p-3">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleBlock,
  type CollapsibleBlockProps,
}
