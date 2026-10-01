import { cva, type VariantProps } from "class-variance-authority"
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const softDescription =
  "**:data-[slot=alert-description]:text-foreground/85"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: cn(
          "border-transparent bg-skrum-destructive-soft text-skrum-destructive-text",
          softDescription
        ),
        info: cn(
          "border-transparent bg-skrum-info-soft text-skrum-info-text",
          softDescription
        ),
        success: cn(
          "border-transparent bg-skrum-success-soft text-skrum-success-text",
          softDescription
        ),
        warning: cn(
          "border-transparent bg-skrum-warning-soft text-skrum-warning-text",
          softDescription
        ),
        error: cn(
          "border-transparent bg-skrum-destructive-soft text-skrum-destructive-text",
          softDescription
        ),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>

const variantIcons: Partial<Record<AlertVariant, LucideIcon>> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
  destructive: CircleAlert,
}

const variantRoles: Partial<Record<AlertVariant, React.AriaRole>> = {
  info: "note",
  success: "status",
  warning: "status",
}

type AlertProps = Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof alertVariants> & {
    title?: React.ReactNode
    description?: React.ReactNode
    action?: React.ReactNode
    icon?: LucideIcon
  }

function Alert({
  className,
  variant,
  title,
  description,
  action,
  icon,
  children,
  ...props
}: AlertProps) {
  const role = variantRoles[variant ?? "default"] ?? "alert"

  if (title === undefined) {
    return (
      <div
        data-slot="alert"
        role={role}
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {children}
      </div>
    )
  }

  const Icon = icon ?? variantIcons[variant ?? "default"]

  return (
    <div
      data-slot="alert"
      role={role}
      className={cn(
        alertVariants({ variant }),
        "flex flex-wrap gap-x-3 gap-y-2",
        className
      )}
      {...props}
    >
      {Icon && <Icon aria-hidden="true" />}
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <AlertTitle className="line-clamp-none font-title leading-5 tracking-normal">
          {title}
        </AlertTitle>
        {description !== undefined && (
          <AlertDescription className="text-body-sm">
            {description}
          </AlertDescription>
        )}
        {children}
      </div>
      {action !== undefined && (
        <div data-slot="alert-action" className="shrink-0 text-foreground">
          {action}
        </div>
      )}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, alertVariants }
export type { AlertProps }
