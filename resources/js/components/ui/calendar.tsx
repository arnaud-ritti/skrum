import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import * as React from "react"
import {
  DayPicker,
  type DateRange,
  type DayButtonProps,
  type Matcher,
} from "react-day-picker"
import { enUS, fr } from "react-day-picker/locale"

import { useTrans } from "@/hooks/use-trans"
import { cn } from "@/lib/utils"

type CalendarLocale = "fr" | "en"

const dayPickerLocales = { fr, en: enUS } as const

const intlTags: Record<CalendarLocale, string> = { fr: "fr", en: "en-US" }

type CalendarBaseProps = {
  locale?: CalendarLocale
  weekStartsOn?: 0 | 1
  disabled?: (date: Date) => boolean
  today?: Date
  month?: Date
  defaultMonth?: Date
  onMonthChange?: (month: Date) => void
  showOutsideDays?: boolean
  className?: string
  classNames?: React.ComponentProps<typeof DayPicker>["classNames"]
}

type CalendarSingleProps = CalendarBaseProps & {
  mode: "single"
  selected?: Date
  onSelect: (date: Date | undefined) => void
  required?: boolean
}

type CalendarRangeProps = CalendarBaseProps & {
  mode: "range"
  selected?: DateRange
  onSelect: (range: DateRange | undefined) => void
}

type CalendarProps = CalendarSingleProps | CalendarRangeProps

function formatDayLabel(
  date: Date,
  locale: CalendarLocale,
  today: Date
): string {
  return new Intl.DateTimeFormat(intlTags[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date)
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: DayButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers.focused) {
      ref.current?.focus()
    }
  }, [modifiers.focused])

  const isRangeMiddle = Boolean(modifiers.range_middle)
  const isSelectedEdge = Boolean(modifiers.selected) && !isRangeMiddle

  return (
    <button
      ref={ref}
      data-slot="calendar-day"
      data-day={day.isoDate}
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-md text-sm tabular-nums outline-none transition-colors duration-140 ease-standard motion-reduce:transition-none",
        "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        modifiers.outside && "text-muted-foreground",
        modifiers.today &&
          "font-bold text-skrum-primary-text after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-current",
        isRangeMiddle &&
          "rounded-none bg-transparent text-skrum-primary-text hover:bg-transparent",
        isSelectedEdge &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        modifiers.range_start && "rounded-r-none",
        modifiers.range_end && "rounded-l-none",
        modifiers.range_start && modifiers.range_end && "rounded-md",
        modifiers.disabled &&
          "pointer-events-none line-through opacity-45 hover:bg-transparent",
        className
      )}
      {...props}
      aria-current={modifiers.today ? "date" : undefined}
      aria-disabled={modifiers.disabled ? true : undefined}
    />
  )
}

function Calendar({
  mode,
  selected,
  onSelect,
  locale = "en",
  weekStartsOn,
  disabled,
  today,
  month,
  defaultMonth,
  onMonthChange,
  showOutsideDays = true,
  className,
  classNames,
  ...rest
}: CalendarProps) {
  const { t } = useTrans()
  const referenceDay = today ?? new Date()
  const firstDay = weekStartsOn ?? (locale === "fr" ? 1 : 0)

  const sharedProps = {
    locale: dayPickerLocales[locale],
    weekStartsOn: firstDay,
    disabled: disabled as Matcher | undefined,
    today,
    month,
    defaultMonth,
    onMonthChange,
    showOutsideDays,
    fixedWeeks: true,
    "data-slot": "calendar",
    className: cn("w-fit", className),
    classNames: {
      root: "w-fit",
      months: "relative flex flex-col gap-2",
      month: "flex flex-col gap-2",
      nav: "absolute inset-x-0 top-0 flex items-center justify-between",
      button_previous:
        "inline-flex size-8 items-center justify-center rounded-md outline-none transition-colors duration-140 ease-standard hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
      button_next:
        "inline-flex size-8 items-center justify-center rounded-md outline-none transition-colors duration-140 ease-standard hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
      month_caption:
        "flex h-8 items-center justify-center px-9 text-sm font-semibold capitalize",
      caption_label: "truncate",
      month_grid: "w-full border-collapse",
      weekdays: "",
      weekday: "size-9 text-center text-xs font-semibold text-muted-foreground",
      week: "",
      day: "size-9 p-0 text-center",
      day_button: "",
      today: "",
      outside: "",
      disabled: "",
      selected: "",
      range_start: "rounded-l-md bg-skrum-primary-soft",
      range_middle: "bg-skrum-primary-soft",
      range_end: "rounded-r-md bg-skrum-primary-soft",
      ...classNames,
    },
    labels: {
      labelDayButton: (date: Date) => formatDayLabel(date, locale, referenceDay),
      labelPrevious: () => t("Previous month"),
      labelNext: () => t("Next month"),
    },
    components: {
      DayButton: CalendarDayButton,
      Chevron: ({
        orientation,
        className: chevronClassName,
      }: {
        orientation?: "left" | "right" | "up" | "down"
        className?: string
      }) => {
        if (orientation === "left") {
          return <ChevronLeftIcon className={cn("size-4", chevronClassName)} />
        }

        if (orientation === "right") {
          return <ChevronRightIcon className={cn("size-4", chevronClassName)} />
        }

        return <ChevronDownIcon className={cn("size-4", chevronClassName)} />
      },
    },
  }

  if (mode === "range") {
    return (
      <DayPicker
        {...sharedProps}
        mode="range"
        selected={selected as DateRange | undefined}
        onSelect={(range) => (onSelect as (range: DateRange | undefined) => void)(range)}
      />
    )
  }

  const { required } = rest as { required?: boolean }

  if (required) {
    return (
      <DayPicker
        {...sharedProps}
        mode="single"
        required
        selected={selected as Date | undefined}
        onSelect={(date) => (onSelect as (date: Date | undefined) => void)(date)}
      />
    )
  }

  return (
    <DayPicker
      {...sharedProps}
      mode="single"
      selected={selected as Date | undefined}
      onSelect={(date) => (onSelect as (date: Date | undefined) => void)(date)}
    />
  )
}

export { Calendar, CalendarDayButton, type CalendarProps, type CalendarLocale }
