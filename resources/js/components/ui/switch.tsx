import * as SwitchPrimitive from "@radix-ui/react-switch"
import { LockIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  label?: React.ReactNode
  description?: React.ReactNode
  lockedReason?: string
}

function SwitchControl({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-input shadow-xs outline-none transition-colors duration-140 ease-standard focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 translate-x-px rounded-full bg-card shadow-card transition-transform duration-220 ease-spring motion-reduce:transition-none data-[state=checked]:translate-x-4.25 data-[state=checked]:bg-primary-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

function Switch({
  label,
  description,
  lockedReason,
  id,
  className,
  disabled,
  "aria-describedby": callerDescribedBy,
  ...props
}: SwitchProps) {
  const generatedId = React.useId()
  const isLocked = lockedReason !== undefined
  const isDisabled = disabled || isLocked

  if (label === undefined && description === undefined && !isLocked) {
    return (
      <SwitchControl
        id={id}
        className={className}
        disabled={isDisabled}
        aria-describedby={callerDescribedBy}
        {...props}
      />
    )
  }

  const controlId = id ?? generatedId
  const descriptionId = `${controlId}-description`
  const lockedReasonId = `${controlId}-locked-reason`
  const describedBy = [
    description === undefined ? null : descriptionId,
    isLocked ? lockedReasonId : null,
    callerDescribedBy ?? null,
  ]
    .filter((part) => part !== null)
    .join(" ")

  return (
    <div
      data-slot="switch-field"
      data-locked={isLocked ? "true" : undefined}
      data-disabled={isDisabled ? "true" : undefined}
      className="flex min-w-0 items-start gap-2 data-[disabled=true]:opacity-50 max-md:py-1.5"
    >
      <SwitchControl
        id={controlId}
        disabled={isDisabled}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        className={cn("mt-0.5", className)}
        {...props}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <label
          htmlFor={controlId}
          data-slot="switch-label"
          className={cn(
            "text-sm leading-normal select-none",
            isDisabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          {label}
        </label>
        {description !== undefined && (
          <p
            id={descriptionId}
            data-slot="switch-description"
            className="text-body-sm leading-snug text-muted-foreground"
          >
            {description}
          </p>
        )}
        {isLocked && (
          <p
            id={lockedReasonId}
            data-slot="switch-locked-reason"
            className="flex items-start gap-1 text-body-sm leading-snug text-muted-foreground"
          >
            <LockIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>{lockedReason}</span>
          </p>
        )}
      </div>
    </div>
  )
}

export { Switch }
export type { SwitchProps }
