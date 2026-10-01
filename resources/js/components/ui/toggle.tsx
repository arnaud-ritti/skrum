import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"
import type { LucideIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap text-foreground hover:bg-muted data-[state=on]:bg-skrum-primary-soft data-[state=on]:text-skrum-primary-text disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[state=on]:[&_svg]:text-current focus-visible:ring-2 focus-visible:ring-ring outline-none transition-[color,background-color,border-color,box-shadow] duration-140 ease-standard aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        ghost: "bg-transparent",
        outline:
          "border border-input bg-card shadow-card hover:bg-accent data-[state=on]:border-primary",
        toolbar: "bg-transparent",
        segmented: "bg-transparent",
      },
      size: {
        default: "h-9 px-3 min-w-9",
        sm: "h-8 px-2 min-w-8",
        lg: "h-10 px-4 min-w-10",
        icon: "size-9 px-0",
      },
    },
    compoundVariants: [
      {
        variant: "toolbar",
        class: "h-8 min-w-8 rounded-sm px-2",
      },
      {
        variant: "toolbar",
        size: "icon",
        class: "size-8 px-0",
      },
      {
        variant: "segmented",
        class:
          "h-7.5 min-w-0 rounded-md px-3 text-muted-foreground hover:text-foreground data-[variant=segmented]:text-body-sm data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-card [&_svg]:text-current",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ToggleProps = React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    icon?: LucideIcon
  }

function Toggle({
  className,
  variant,
  size,
  icon: Icon,
  children,
  ...props
}: ToggleProps) {
  const isIconOnly = Icon !== undefined && children === undefined

  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(
        toggleVariants({
          variant,
          size: size ?? (isIconOnly ? "icon" : undefined),
          className,
        })
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </TogglePrimitive.Root>
  )
}

export { Toggle, toggleVariants }
export type { ToggleProps }
