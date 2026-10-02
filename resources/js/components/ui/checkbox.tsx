import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  label?: React.ReactNode
  description?: React.ReactNode
}

function CheckboxControl({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer group/checkbox size-4 shrink-0 rounded-xs border border-input bg-card text-primary-foreground shadow-xs outline-none transition-[color,background-color,border-color,box-shadow] duration-140 ease-standard hover:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]/checkbox:hidden" />
        <MinusIcon className="hidden size-3.5 group-data-[state=indeterminate]/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

function Checkbox({ label, description, id, className, disabled, ...props }: CheckboxProps) {
  const generatedId = React.useId()

  if (label === undefined && description === undefined) {
    return <CheckboxControl id={id} className={className} disabled={disabled} {...props} />
  }

  const controlId = id ?? generatedId
  const descriptionId = `${controlId}-description`

  return (
    <div
      data-slot="checkbox-field"
      data-disabled={disabled ? "true" : undefined}
      className="flex min-w-0 items-start gap-2 data-[disabled=true]:opacity-50 max-md:py-1.5"
    >
      <CheckboxControl
        id={controlId}
        disabled={disabled}
        aria-describedby={description === undefined ? undefined : descriptionId}
        className={cn("mt-0.5", className)}
        {...props}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <label
          htmlFor={controlId}
          data-slot="checkbox-label"
          className={cn(
            "text-sm leading-normal select-none",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          {label}
        </label>
        {description !== undefined && (
          <p
            id={descriptionId}
            data-slot="checkbox-description"
            className="text-body-sm leading-snug text-muted-foreground"
          >
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

export { Checkbox }
