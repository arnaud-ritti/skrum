import { OTPInput, OTPInputContext } from "input-otp"
import { Minus } from "lucide-react"
import * as React from "react"

import { useTrans } from "@/hooks/use-trans"
import { cn } from "@/lib/utils"

type InputOTPState = {
  invalid: boolean
  pasted: boolean
  disabled: boolean
}

const InputOTPStateContext = React.createContext<InputOTPState>({
  invalid: false,
  pasted: false,
  disabled: false,
})

type InputOTPProps = React.ComponentPropsWithoutRef<typeof OTPInput> & {
  invalid?: boolean
  error?: string
  pasted?: boolean
  label?: string
}

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  InputOTPProps
>(
  (
    {
      className,
      containerClassName,
      invalid,
      error,
      pasted = false,
      label,
      disabled,
      ...props
    },
    ref
  ) => {
    const { t } = useTrans()
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const messageId = React.useId()
    const hasError = Boolean(invalid) || Boolean(error)
    const message = error ?? (pasted ? t("Code pasted from the clipboard") : null)

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node

        if (typeof ref === "function") {
          ref(node)
          return
        }

        if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    React.useEffect(() => {
      if (hasError) {
        inputRef.current?.select()
      }
    }, [hasError, error])

    const describedBy =
      [props["aria-describedby"], message ? messageId : null]
        .filter(Boolean)
        .join(" ") || undefined

    return (
      <InputOTPStateContext.Provider
        value={{ invalid: hasError, pasted, disabled: Boolean(disabled) }}
      >
        <OTPInput
          {...props}
          ref={setRefs}
          disabled={disabled}
          aria-label={label ?? props["aria-label"]}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={describedBy}
          containerClassName={cn(
            "flex w-fit max-w-full items-center gap-2 has-[:disabled]:opacity-55",
            hasError && "motion-safe:animate-[nudge_0.6s_var(--ease-standard)_1]",
            containerClassName
          )}
          className={cn("disabled:cursor-not-allowed", className)}
        />
        {message ? (
          <p
            id={messageId}
            data-slot="input-otp-message"
            role={error ? "alert" : "status"}
            className={cn(
              "text-body-sm",
              error ? "text-skrum-destructive-text" : "text-skrum-success-text"
            )}
          >
            {message}
          </p>
        ) : null}
      </InputOTPStateContext.Provider>
    )
  }
)
InputOTP.displayName = "InputOTP"

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
))
InputOTPGroup.displayName = "InputOTPGroup"

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { invalid, pasted, disabled } = React.useContext(InputOTPStateContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index]

  return (
    <div
      ref={ref}
      data-slot="input-otp-slot"
      data-active={isActive}
      aria-hidden="true"
      aria-invalid={invalid ? true : undefined}
      className={cn(
        "relative flex h-11 w-10 items-center justify-center border-y border-r border-input bg-card font-mono text-xl font-semibold tabular-nums text-foreground transition-colors duration-fast ease-standard first:rounded-l-md first:border-l last:rounded-r-md @max-card-wide/card:w-9",
        "data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-2 data-[active=true]:ring-ring",
        "aria-invalid:border-destructive aria-invalid:text-skrum-destructive-text",
        pasted && !invalid && "bg-skrum-success-soft",
        disabled && "bg-muted",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  )
})
InputOTPSlot.displayName = "InputOTPSlot"

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    className={cn("text-muted-foreground", className)}
    {...props}
  >
    <Minus />
  </div>
))
InputOTPSeparator.displayName = "InputOTPSeparator"

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
