import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react"
import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { useTrans } from "@/hooks/use-trans"
import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

type TableRowProps = React.ComponentProps<"tr"> & {
  selected?: boolean
  done?: boolean
  late?: boolean
}

function TableRow({
  className,
  selected,
  done,
  late,
  ...props
}: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      data-state={selected ? "selected" : undefined}
      data-done={done ? "true" : undefined}
      data-late={late ? "true" : undefined}
      className={cn(
        "group/row hover:bg-muted data-[state=selected]:bg-skrum-primary-soft data-[done=true]:text-muted-foreground border-b transition-colors motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-muted-foreground h-9 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap [&:has([role=checkbox])]:w-10",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2.5 align-middle [&:has([role=checkbox])]:w-10",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

type SortDirection = "asc" | "desc"

type TableSortHeadProps = Omit<React.ComponentProps<"th">, "onClick"> & {
  direction?: SortDirection | null
  onSort: () => void
}

function TableSortHead({
  className,
  direction = null,
  onSort,
  children,
  ...props
}: TableSortHeadProps) {
  const Icon =
    direction === "asc"
      ? ArrowUpIcon
      : direction === "desc"
        ? ArrowDownIcon
        : ChevronsUpDownIcon

  return (
    <TableHead
      data-slot="table-sort-head"
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
      className={className}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "-ml-2 inline-flex h-7 max-w-full items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
          direction ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="whitespace-nowrap">{children}</span>
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </TableHead>
  )
}

type TableCheckboxProps = Omit<
  React.ComponentProps<typeof Checkbox>,
  "checked" | "onCheckedChange"
> & {
  checked: boolean | "indeterminate"
  onCheckedChange: (checked: boolean) => void
}

function TableCheckbox({
  checked,
  onCheckedChange,
  ...props
}: TableCheckboxProps) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      {...props}
    />
  )
}

function TableSelectAll({
  checked,
  onCheckedChange,
  "aria-label": ariaLabel,
  ...props
}: TableCheckboxProps) {
  const { t } = useTrans()

  return (
    <TableCheckbox
      data-slot="table-select-all"
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel ?? t("Select all rows")}
      {...props}
    />
  )
}

type TableBulkBarProps = React.ComponentProps<"div"> & {
  count: number
}

function TableBulkBar({
  className,
  count,
  children,
  ...props
}: TableBulkBarProps) {
  const { t } = useTrans()

  return (
    <div
      data-slot="table-bulk-bar"
      className={cn("flex min-h-10 items-center gap-3 px-3 py-1.5", className)}
      {...props}
    >
      <p
        role="status"
        className="text-skrum-primary-text bg-skrum-primary-soft text-body-sm min-w-0 truncate rounded-md px-2.5 py-1 font-semibold"
      >
        {count === 1
          ? t("1 selected")
          : t(":count selected", { count })}
      </p>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  )
}

type TableEmptyProps = Omit<React.ComponentProps<"tr">, "children"> & {
  colSpan: number
  children?: React.ReactNode
}

function TableEmpty({ colSpan, children, className, ...props }: TableEmptyProps) {
  const { t } = useTrans()

  return (
    <tr data-slot="table-empty" className={className} {...props}>
      <td
        colSpan={colSpan}
        className="text-muted-foreground px-3 py-10 text-center text-sm"
      >
        {children ?? t("Nothing to show")}
      </td>
    </tr>
  )
}

type TableLoadingProps = {
  columns: number
  rows?: number
}

function TableLoading({ columns, rows = 5 }: TableLoadingProps) {
  const { t } = useTrans()

  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          data-slot="table-loading-row"
          aria-busy="true"
          className="border-b"
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td key={columnIndex} className="px-3 py-2.5">
              <Skeleton className="h-4 w-full" />
              {rowIndex === 0 && columnIndex === 0 ? (
                <span className="sr-only" role="status">
                  {t("Loading")}
                </span>
              ) : null}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableSortHead,
  TableCheckbox,
  TableSelectAll,
  TableBulkBar,
  TableEmpty,
  TableLoading,
}
export type { SortDirection }
