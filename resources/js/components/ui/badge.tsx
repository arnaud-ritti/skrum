import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowUpRight, type LucideIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex min-h-5.5 items-center justify-center gap-1 rounded-sm border border-transparent px-2 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        destructive:
          "bg-skrum-destructive-soft text-skrum-destructive-text focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        muted:
          "bg-muted text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        soft: "bg-skrum-primary-soft text-skrum-primary-text [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        success:
          "bg-skrum-success-soft text-skrum-success-text [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        warning:
          "bg-skrum-warning-soft text-skrum-warning-text [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        info: "bg-skrum-info-soft text-skrum-info-text [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
      shape: {
        rounded: "",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "rounded",
    },
  }
)

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    icon?: LucideIcon
    dot?: string
  }

function Badge({
  className,
  variant,
  shape,
  icon: Icon,
  dot,
  asChild = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, shape }), className)}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          data-slot="badge-dot"
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
        />
      ) : null}
      {Icon ? <Icon aria-hidden="true" /> : null}
      {asChild ? <Slottable>{children}</Slottable> : children}
      {asChild ? <ArrowUpRight aria-hidden="true" /> : null}
    </Comp>
  )
}

export { Badge, badgeVariants }
export type { BadgeProps }
