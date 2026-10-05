import * as SliderPrimitive from "@radix-ui/react-slider"
import * as React from "react"

import { cn } from "@/lib/utils"

type SliderProps = Omit<
  React.ComponentProps<typeof SliderPrimitive.Root>,
  "value" | "onValueChange" | "min" | "max" | "step" | "defaultValue"
> & {
  label: string
  value: number[]
  onValueChange: (value: number[]) => void
  min: number
  max: number
  step?: number
  format?: (value: number) => string
  showBounds?: boolean
}

function clampToStep(raw: number, min: number, max: number, step: number) {
  const snapped = min + Math.round((raw - min) / step) * step
  const decimals = (String(step).split(".")[1] ?? "").length

  return Number(Math.min(Math.max(snapped, min), max).toFixed(decimals))
}

function Slider({
  className,
  label,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  format,
  showBounds = false,
  disabled,
  id,
  ...props
}: SliderProps) {
  const generatedId = React.useId()
  const baseId = id ?? generatedId
  const labelId = `${baseId}-label`
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  const formatValue = React.useCallback(
    (v: number) => (format ? format(v) : String(v)),
    [format]
  )

  React.useEffect(() => {
    if (!isDragging) {
      return
    }

    const stop = () => setIsDragging(false)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)

    return () => {
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
  }, [isDragging])

  const shownValue = value.map(formatValue).join(" – ")

  function handlePageKey(
    event: React.KeyboardEvent<HTMLSpanElement>,
    index: number
  ) {
    if (disabled || (event.key !== "PageUp" && event.key !== "PageDown")) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const direction = event.key === "PageUp" ? 1 : -1
    const jump = Math.max(step, (max - min) / 10)
    const next = clampToStep(value[index] + direction * jump, min, max, step)
    const updated = value.slice()
    updated[index] = next

    if (updated.length > 1) {
      updated.sort((a, b) => a - b)
    }

    onValueChange(updated)
  }

  return (
    <div
      data-slot="slider-field"
      data-disabled={disabled ? "" : undefined}
      className={cn("flex w-full flex-col gap-2", disabled && "opacity-50")}
    >
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span
          id={labelId}
          data-slot="slider-label"
          className="min-w-0 truncate font-medium text-foreground"
        >
          {label}
        </span>
        <span
          data-slot="slider-value"
          className="shrink-0 font-mono text-foreground tabular-nums"
        >
          {shownValue}
        </span>
      </div>
      <SliderPrimitive.Root
        data-slot="slider"
        value={value}
        onValueChange={onValueChange}
        onPointerDown={disabled ? undefined : () => setIsDragging(true)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          "relative flex w-full touch-none items-center py-2 select-none data-[disabled]:cursor-not-allowed",
          className
        )}
        {...props}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border"
        >
          <SliderPrimitive.Range
            data-slot="slider-range"
            className="absolute h-full bg-primary"
          />
        </SliderPrimitive.Track>
        {value.map((thumbValue, index) => (
          <SliderPrimitive.Thumb
            key={index}
            data-slot="slider-thumb"
            aria-label={
              value.length > 1 ? `${label} ${index + 1}` : label
            }
            aria-valuetext={formatValue(thumbValue)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex(null)}
            onKeyDown={(event) => handlePageKey(event, index)}
            className="relative block size-4.5 shrink-0 rounded-full border-2 border-primary bg-card shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none"
          >
            {focusedIndex === index ||
            (isDragging && focusedIndex === null && value.length === 1) ? (
              <span
                aria-hidden="true"
                data-slot="slider-bubble"
                className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-sm bg-foreground px-2 py-0.5 font-mono text-xs whitespace-nowrap text-background tabular-nums"
              >
                {formatValue(thumbValue)}
              </span>
            ) : null}
          </SliderPrimitive.Thumb>
        ))}
      </SliderPrimitive.Root>
      {showBounds ? (
        <div
          data-slot="slider-bounds"
          className="flex justify-between font-mono text-xs text-muted-foreground tabular-nums"
        >
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </div>
      ) : null}
    </div>
  )
}

export { Slider }
export type { SliderProps }
