import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import * as React from "react"

import { cn } from "@/lib/utils"

type RadioOption<T extends string> = {
  value: T
  label: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
}

type RadioGroupProps<T extends string = string> = Omit<
  React.ComponentProps<typeof RadioGroupPrimitive.Root>,
  "value" | "onValueChange" | "defaultValue"
> & {
  value?: T
  defaultValue?: T
  onValueChange?: (value: T) => void
  options?: RadioOption<T>[]
  variant?: "default" | "card"
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border border-input bg-card text-primary shadow-xs outline-none transition-[color,border-color,box-shadow] duration-140 ease-standard hover:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input data-[state=checked]:border-primary aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <span className="size-2 rounded-full bg-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

/**
 * A card-shaped radio: the whole card is the `role="radio"` element and its
 * children are its content, so the text of the card belongs to the radio.
 */
function RadioGroupCardItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-card-item"
      className={cn(
        "group/radio-card flex w-full min-w-0 cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-card outline-none transition-[background-color,border-color,box-shadow] duration-140 ease-standard hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card data-[state=checked]:border-primary data-[state=checked]:bg-skrum-primary-soft data-[state=checked]:ring-2 data-[state=checked]:ring-primary",
        className
      )}
      {...props}
    >
      {children}
    </RadioGroupPrimitive.Item>
  )
}

function RadioOptionRow<T extends string>({
  option,
  variant,
}: {
  option: RadioOption<T>
  variant: "default" | "card"
}) {
  const id = React.useId()
  const descriptionId = `${id}-description`
  const isCard = variant === "card"

  return (
    <div
      data-slot="radio-option"
      data-variant={variant}
      data-disabled={option.disabled ? "true" : undefined}
      className={cn(
        "flex min-w-0 items-start gap-2 data-[disabled=true]:opacity-50",
        isCard &&
          "rounded-lg border border-input bg-card p-3 transition-colors duration-140 ease-standard motion-reduce:transition-none has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-skrum-primary-soft has-[[data-state=unchecked]]:hover:border-ring/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
        !isCard && "max-md:py-1.5"
      )}
    >
      <RadioGroupItem
        id={id}
        value={option.value}
        disabled={option.disabled}
        aria-describedby={
          option.description === undefined ? undefined : descriptionId
        }
        className={cn("mt-0.5", isCard && "focus-visible:ring-0 focus-visible:ring-offset-0")}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <label
          htmlFor={id}
          data-slot="radio-label"
          className={cn(
            "text-sm leading-normal select-none",
            option.disabled ? "cursor-not-allowed" : "cursor-pointer",
            isCard && "font-medium"
          )}
        >
          {option.label}
        </label>
        {option.description !== undefined && (
          <p
            id={descriptionId}
            data-slot="radio-description"
            className="text-body-sm leading-snug text-muted-foreground"
          >
            {option.description}
          </p>
        )}
      </div>
    </div>
  )
}

function RadioGroup<T extends string = string>({
  className,
  options,
  variant = "default",
  children,
  onValueChange,
  ...props
}: RadioGroupProps<T>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      data-variant={variant}
      className={cn("grid gap-3", variant === "card" && "gap-2", className)}
      onValueChange={
        onValueChange === undefined
          ? undefined
          : (value) => onValueChange(value as T)
      }
      {...props}
    >
      {options === undefined
        ? children
        : options.map((option) => (
            <RadioOptionRow key={option.value} option={option} variant={variant} />
          ))}
    </RadioGroupPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupCardItem, RadioGroupItem }
export type { RadioGroupProps, RadioOption }
