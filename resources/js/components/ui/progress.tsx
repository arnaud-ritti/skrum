import * as ProgressPrimitive from "@radix-ui/react-progress"
import * as React from "react"

import { cn } from "@/lib/utils"

type ProgressProps = Omit<
  React.ComponentProps<typeof ProgressPrimitive.Root>,
  "value" | "max"
> & {
  /** undefined (or null) renders the indeterminate state */
  value?: number | null
  max?: number
  label?: string
  /** written value, e.g. "7 / 9"; defaults to a percentage */
  valueLabel?: string
  tone?: "primary" | "success"
  description?: string
}

function Progress({
  className,
  value,
  max = 100,
  label,
  valueLabel,
  tone,
  description,
  id,
  ...props
}: ProgressProps) {
  const generatedId = React.useId()
  const baseId = id ?? generatedId
  const labelId = `${baseId}-label`
  const descriptionId = `${baseId}-description`

  const isIndeterminate = value === undefined || value === null
  const safeMax = max > 0 ? max : 100
  const clamped = isIndeterminate ? 0 : Math.min(Math.max(value, 0), safeMax)
  const percent = (clamped / safeMax) * 100
  const resolvedTone = tone ?? (!isIndeterminate && percent >= 100 ? "success" : "primary")
  const shownValue = isIndeterminate
    ? valueLabel
    : (valueLabel ?? `${Math.round(percent)}%`)

  const ariaLabelledBy =
    props["aria-labelledby"] ?? (label ? labelId : undefined)

  return (
    <div data-slot="progress-field" className="flex w-full flex-col gap-1.5">
      {label || shownValue ? (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          {label ? (
            <span
              id={labelId}
              data-slot="progress-label"
              className="min-w-0 truncate font-medium text-foreground"
            >
              {label}
            </span>
          ) : (
            <span />
          )}
          {shownValue ? (
            <span
              data-slot="progress-value"
              className="shrink-0 font-mono text-muted-foreground tabular-nums"
            >
              {shownValue}
            </span>
          ) : null}
        </div>
      ) : null}
      <ProgressPrimitive.Root
        id={id}
        data-slot="progress"
        data-tone={resolvedTone}
        value={isIndeterminate ? null : clamped}
        max={safeMax}
        aria-busy={isIndeterminate ? true : undefined}
        aria-valuetext={isIndeterminate ? undefined : shownValue}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border",
          className
        )}
        {...props}
      >
        {isIndeterminate ? (
          <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className="h-full w-2/5 animate-indeterminate rounded-full bg-primary motion-reduce:animate-none"
          />
        ) : (
          <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className={cn(
              "h-full rounded-full transition-[width] duration-(--duration-base) ease-(--ease-standard) motion-reduce:transition-none",
              resolvedTone === "success" ? "bg-skrum-success" : "bg-primary"
            )}
            style={{ width: `${percent}%` }}
          />
        )}
      </ProgressPrimitive.Root>
      {description ? (
        <p
          id={descriptionId}
          data-slot="progress-description"
          className="text-xs text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}

export { Progress }
export type { ProgressProps }
