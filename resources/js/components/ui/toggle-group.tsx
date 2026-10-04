import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { type VariantProps } from "class-variance-authority"
import { Lock, type LucideIcon } from "lucide-react"
import * as React from "react"

import { Separator } from "@/components/ui/separator"
import { toggleVariants } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & { joined: boolean }
>({
  size: "default",
  variant: "default",
  joined: true,
})

const groupVariantClasses = {
  default: "gap-0",
  ghost: "gap-1",
  outline: "gap-0",
  toolbar: "gap-0.5 rounded-lg border bg-card p-0.5 shadow-card",
  segmented: "gap-0.5 rounded-lg bg-muted p-0.75",
}

type LegacyToggleGroupProps = React.ComponentProps<
  typeof ToggleGroupPrimitive.Root
> &
  VariantProps<typeof toggleVariants>

function LegacyToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: LegacyToggleGroupProps) {
  const joined = variant === undefined || variant === "default" || variant === "outline"

  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/toggle-group flex items-center rounded-md data-[variant=outline]:shadow-card",
        groupVariantClasses[variant ?? "default"],
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, joined }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "min-w-0 shrink-0 focus:z-10 focus-visible:z-10",
        context.joined &&
          "rounded-none shadow-none first:rounded-l-md last:rounded-r-md data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

interface ToggleOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  disabled?: boolean
  separatorBefore?: boolean
}

type ToggleGroupOptionsProps<T extends string> = {
  options: ToggleOption<T>[]
  variant?: "ghost" | "outline" | "toolbar" | "segmented"
  iconOnly?: boolean
  fullWidth?: boolean
  disabled?: boolean
  disabledReason?: string
  className?: string
  id?: string
  "aria-label": string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
} & (
  | { type: "single"; value: T; onValueChange: (value: T) => void }
  | { type: "multiple"; value: T[]; onValueChange: (value: T[]) => void }
)

function OptionItem<T extends string>({
  option,
  variant,
  iconOnly,
}: {
  option: ToggleOption<T>
  variant: NonNullable<ToggleGroupOptionsProps<T>["variant"]>
  iconOnly: boolean
}) {
  const Icon = option.icon
  const showOnlyIcon = iconOnly && Icon !== undefined
  const iconClassName = variant === "segmented" ? "size-3.5" : undefined

  const item = (
    <ToggleGroupItem
      value={option.value}
      disabled={option.disabled}
      aria-label={showOnlyIcon ? option.label : undefined}
      size={showOnlyIcon ? "icon" : undefined}
    >
      {Icon ? <Icon aria-hidden="true" className={iconClassName} /> : null}
      {showOnlyIcon ? null : <span className="truncate">{option.label}</span>}
    </ToggleGroupItem>
  )

  const separator = option.separatorBefore ? (
    <Separator orientation="vertical" className="mx-1 h-5" />
  ) : null

  if (!showOnlyIcon) {
    return (
      <>
        {separator}
        {item}
      </>
    )
  }

  return (
    <>
      {separator}
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent>{option.label}</TooltipContent>
      </Tooltip>
    </>
  )
}

function OptionsToggleGroup<T extends string>(
  props: ToggleGroupOptionsProps<T>
) {
  const {
    options,
    variant = "ghost",
    iconOnly = false,
    fullWidth = false,
    disabledReason,
    className,
    id,
    "aria-label": ariaLabel,
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
  } = props
  const disabled = props.disabled === true || disabledReason !== undefined
  const reasonId = React.useId()
  const isJoined = false

  const items = options.map((option) => (
    <OptionItem
      key={option.value}
      option={option}
      variant={variant}
      iconOnly={iconOnly}
    />
  ))

  const rootClassName = cn(
    "group/toggle-group flex max-w-full items-center",
    groupVariantClasses[variant],
    variant === "outline" && "flex-wrap gap-2",
    variant === "segmented" && fullWidth && "w-full [&>*]:flex-auto",
    className
  )

  const sharedProps = {
    "data-slot": "toggle-group",
    "data-variant": variant,
    id,
    "aria-label": ariaLabel,
    "aria-disabled": disabled ? true : undefined,
    "aria-invalid": invalid,
    "aria-describedby":
      [disabledReason ? reasonId : undefined, describedBy]
        .filter(Boolean)
        .join(" ") || undefined,
    disabled,
    className: rootClassName,
  }

  const context = { variant, size: undefined, joined: isJoined }

  const root =
    props.type === "single" ? (
      <ToggleGroupPrimitive.Root
        {...sharedProps}
        type="single"
        value={props.value}
        onValueChange={(next) => {
          if (next === "") {
            return
          }

          props.onValueChange(next as T)
        }}
      >
        <ToggleGroupContext.Provider value={context}>
          {items}
        </ToggleGroupContext.Provider>
      </ToggleGroupPrimitive.Root>
    ) : (
      <ToggleGroupPrimitive.Root
        {...sharedProps}
        type="multiple"
        role="group"
        value={props.value}
        onValueChange={(next) => props.onValueChange(next as T[])}
      >
        <ToggleGroupContext.Provider value={context}>
          {items}
        </ToggleGroupContext.Provider>
      </ToggleGroupPrimitive.Root>
    )

  if (disabledReason === undefined) {
    return root
  }

  return (
    <div
      data-slot="toggle-group-field"
      className={cn(
        "flex max-w-full flex-col items-start gap-1.5",
        variant === "segmented" && fullWidth && "w-full"
      )}
    >
      {root}
      <p
        id={reasonId}
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Lock aria-hidden="true" className="size-3.5 shrink-0" />
        {disabledReason}
      </p>
    </div>
  )
}

function ToggleGroup<T extends string>(
  props: ToggleGroupOptionsProps<T>
): React.JSX.Element
function ToggleGroup(props: LegacyToggleGroupProps): React.JSX.Element
function ToggleGroup(
  props: ToggleGroupOptionsProps<string> | LegacyToggleGroupProps
) {
  if ("options" in props) {
    return <OptionsToggleGroup {...props} />
  }

  return <LegacyToggleGroup {...props} />
}

export { ToggleGroup, ToggleGroupItem }
export type { ToggleGroupOptionsProps, ToggleOption }
