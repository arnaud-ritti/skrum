import { Slot } from "@radix-ui/react-slot"
import * as React from "react"

import { cn } from "@/lib/utils"

type CardChrome = {
  title?: string
  description?: string
  footer?: React.ReactNode
}

/** With asChild, the slotted child is the whole card: no header or footer. */
type CardProps = Omit<React.ComponentProps<"div">, "title"> &
  (
    | ({ asChild?: false } & CardChrome)
    | ({ asChild: true } & { [Key in keyof CardChrome]?: never })
  )

function Card({
  className,
  asChild = false,
  title,
  description,
  footer,
  children,
  ...props
}: CardProps) {
  const classes = cn(
    "@container/card bg-card text-card-foreground flex flex-col gap-0 rounded-xl border py-0 shadow-card",
    className
  )

  if (asChild) {
    return (
      <Slot data-slot="card" className={classes} {...props}>
        {children}
      </Slot>
    )
  }

  const hasHeader = title !== undefined || description !== undefined
  const hasFooter = footer !== undefined && footer !== null

  return (
    <div data-slot="card" className={classes} {...props}>
      {hasHeader && (
        <CardHeader>
          {title !== undefined && <CardTitle>{title}</CardTitle>}
          {description !== undefined && (
            <CardDescription>{description}</CardDescription>
          )}
        </CardHeader>
      )}
      {children}
      {hasFooter && <CardFooter>{footer}</CardFooter>}
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min items-start gap-1 px-5 pt-5 last:pb-5 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto] @max-card-narrow/card:px-4 @max-card-narrow/card:pt-4 @max-card-narrow/card:last:pb-4",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-base leading-snug font-title", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-body-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-5 @max-card-narrow/card:p-4", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-2 px-5 pb-5 first:pt-5 @max-card-narrow/card:flex-wrap @max-card-narrow/card:px-4 @max-card-narrow/card:pb-4 @max-card-narrow/card:*:w-full",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
}
export type { CardProps }
