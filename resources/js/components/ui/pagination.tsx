import { Link } from "@inertiajs/react"
import {
  CheckCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  EllipsisIcon,
} from "lucide-react"
import * as React from "react"

import { LoadingButton } from "@/components/skrum/loading-button"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTrans } from "@/hooks/use-trans"
import { cn } from "@/lib/utils"

type PageItem = number | "start-ellipsis" | "end-ellipsis"

export function buildPageItems(
  page: number,
  pageCount: number,
  siblingCount = 1
): PageItem[] {
  const siblings = Math.max(0, Math.floor(siblingCount))
  const all = Array.from({ length: Math.max(0, pageCount) }, (_, i) => i + 1)

  if (pageCount <= 2 * siblings + 4) {
    return all
  }

  const edgeSpan = 2 * siblings + 3

  if (page <= siblings + 2) {
    return [...all.slice(0, edgeSpan), "end-ellipsis", pageCount]
  }

  if (page >= pageCount - siblings - 1) {
    return [1, "start-ellipsis", ...all.slice(pageCount - edgeSpan)]
  }

  return [
    1,
    "start-ellipsis",
    ...all.slice(page - siblings - 1, page + siblings),
    "end-ellipsis",
    pageCount,
  ]
}

function PaginationNav({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  const { t } = useTrans()

  return (
    <nav
      role="navigation"
      aria-label={t("Pagination")}
      data-slot="pagination"
      className={cn("@container/pg mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row flex-wrap items-center justify-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
  disabled?: boolean
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
  preserveScroll?: boolean
} & Omit<React.ComponentProps<"a">, "href" | "onClick"> & {
  href?: string
  onClick?: (event: React.MouseEvent<Element>) => void
}

const linkClasses = (
  isActive: boolean,
  size: PaginationLinkProps["size"],
  disabled: boolean,
  variant: PaginationLinkProps["variant"],
  className?: string
) =>
  cn(
    buttonVariants({ variant: variant ?? (isActive ? "outline" : "ghost"), size }),
    "min-w-9 tabular-nums",
    isActive && "font-bold shadow-card",
    disabled && "pointer-events-none opacity-50",
    className
  )

function PaginationLink({
  className,
  isActive = false,
  disabled = false,
  size = "icon",
  variant,
  href,
  preserveScroll = true,
  onClick,
  ...props
}: PaginationLinkProps) {
  const classes = linkClasses(isActive, size, disabled, variant, className)

  if (disabled) {
    return (
      <span
        role="link"
        aria-disabled="true"
        data-slot="pagination-link"
        data-disabled="true"
        className={classes}
        {...(props as React.ComponentProps<"span">)}
      />
    )
  }

  if (href === undefined) {
    return (
      <button
        type="button"
        data-slot="pagination-link"
        data-active={isActive}
        aria-current={isActive ? "page" : undefined}
        className={classes}
        onClick={onClick}
        {...(props as React.ComponentProps<"button">)}
      />
    )
  }

  return (
    <Link
      href={href}
      preserveScroll={preserveScroll}
      data-slot="pagination-link"
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
      className={classes}
      onClick={onClick}
      {...(props as Omit<React.ComponentProps<typeof Link>, "href">)}
    />
  )
}

function PaginationPrevious({
  className,
  label,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { label?: string }) {
  const { t } = useTrans()
  const text = label ?? t("Previous")

  return (
    <PaginationLink
      aria-label={text}
      size="default"
      data-slot="pagination-previous"
      className={cn("gap-1 px-2.5 has-[>svg]:px-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon aria-hidden />
      <span className="hidden @md/pg:inline">{text}</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  label,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { label?: string }) {
  const { t } = useTrans()
  const text = label ?? t("Next")

  return (
    <PaginationLink
      aria-label={text}
      size="default"
      data-slot="pagination-next"
      className={cn("gap-1 px-2.5 has-[>svg]:px-2.5", className)}
      {...props}
    >
      <span className="hidden @md/pg:inline">{text}</span>
      <ChevronRightIcon aria-hidden />
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const { t } = useTrans()

  return (
    <span
      role="img"
      aria-label={t("More pages")}
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-9 items-center justify-center text-muted-foreground",
        className
      )}
      {...props}
    >
      <EllipsisIcon aria-hidden className="size-4" />
    </span>
  )
}

interface PaginationBaseProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  siblingCount?: number
  variant?: "numbered" | "compact"
  getHref?: (page: number) => string
  className?: string
}

type PaginationProps = PaginationBaseProps | React.ComponentProps<"nav">

function isGenerated(props: PaginationProps): props is PaginationBaseProps {
  return "pageCount" in props && typeof props.pageCount === "number"
}

function Pagination(props: PaginationProps) {
  if (!isGenerated(props)) {
    return <PaginationNav {...props} />
  }

  return props.variant === "compact" ? (
    <CompactPagination {...props} />
  ) : (
    <NumberedPagination {...props} />
  )
}

function NumberedPagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  getHref,
  className,
}: PaginationBaseProps) {
  const { t } = useTrans()
  const items = buildPageItems(page, pageCount, siblingCount)
  const isFirst = page <= 1
  const isLast = page >= pageCount

  const linkProps = (target: number) => ({
    href: getHref?.(target),
    onClick: getHref ? undefined : () => onPageChange(target),
  })

  return (
    <PaginationNav className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious disabled={isFirst} {...linkProps(page - 1)} />
        </PaginationItem>
        {items.map((item) => {
          if (typeof item !== "number") {
            return (
              <PaginationItem key={item} className="hidden @xs/pg:flex">
                <PaginationEllipsis />
              </PaginationItem>
            )
          }

          const isCurrent = item === page
          const isEdge = item === 1 || item === pageCount

          return (
            <PaginationItem
              key={item}
              className={isCurrent || isEdge ? undefined : "hidden @xs/pg:flex"}
            >
              <PaginationLink
                isActive={isCurrent}
                aria-label={t("Go to page :page", { page: item })}
                {...linkProps(item)}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        })}
        <PaginationItem>
          <PaginationNext disabled={isLast} {...linkProps(page + 1)} />
        </PaginationItem>
      </PaginationContent>
    </PaginationNav>
  )
}

function CompactPagination({
  page,
  pageCount,
  onPageChange,
  getHref,
  className,
}: PaginationBaseProps) {
  const { t } = useTrans()
  const isFirst = page <= 1
  const isLast = page >= pageCount

  const controls = [
    { target: 1, label: t("First page"), icon: ChevronsLeftIcon, off: isFirst },
    {
      target: page - 1,
      label: t("Previous page"),
      icon: ChevronLeftIcon,
      off: isFirst,
    },
    {
      target: page + 1,
      label: t("Next page"),
      icon: ChevronRightIcon,
      off: isLast,
    },
    {
      target: pageCount,
      label: t("Last page"),
      icon: ChevronsRightIcon,
      off: isLast,
    },
  ]

  const renderControl = (control: (typeof controls)[number]) => {
    const Icon = control.icon

    return (
      <PaginationLink
        key={control.label}
        size="icon-sm"
        disabled={control.off}
        aria-label={control.label}
        href={getHref?.(control.target)}
        onClick={getHref ? undefined : () => onPageChange(control.target)}
        variant="outline"
        className="min-w-8"
      >
        <Icon aria-hidden />
      </PaginationLink>
    )
  }

  return (
    <PaginationNav className={className}>
      <div
        data-variant="compact"
        className="flex items-center justify-center gap-1"
      >
        {controls.slice(0, 2).map(renderControl)}
        <span
          aria-live="polite"
          className="px-2 text-body-sm font-semibold whitespace-nowrap tabular-nums"
        >
          {t("Page :page of :total", { page, total: pageCount })}
        </span>
        {controls.slice(2).map(renderControl)}
      </div>
    </PaginationNav>
  )
}

const pageSizes = [10, 20, 50, 100] as const

interface PageSizeBarProps {
  from: number
  to: number
  total: number
  pageSize: (typeof pageSizes)[number]
  onPageSizeChange: (size: PageSizeBarProps["pageSize"]) => void
  onPrev: () => void
  onNext: () => void
  className?: string
}

function PageSizeBar({
  from,
  to,
  total,
  pageSize,
  onPageSizeChange,
  onPrev,
  onNext,
  className,
}: PageSizeBarProps) {
  const { t } = useTrans()
  const labelId = React.useId()
  const isFirst = from <= 1
  const isLast = to >= total

  return (
    <div
      data-slot="page-size-bar"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
        className
      )}
    >
      <span
        aria-live="polite"
        className="text-body-sm text-muted-foreground tabular-nums"
      >
        <b className="font-title text-foreground">{`${from}–${to}`}</b>{" "}
        {t("of :total", { total })}
      </span>
      <div className="flex items-center gap-2">
        <span
          id={labelId}
          className="text-body-sm whitespace-nowrap text-muted-foreground"
        >
          {t("Rows per page")}
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) =>
            onPageSizeChange(Number(value) as PageSizeBarProps["pageSize"])
          }
        >
          <SelectTrigger size="sm" aria-labelledby={labelId} className="h-8 w-18">
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {pageSizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("Previous page")}
          aria-disabled={isFirst}
          className={cn(isFirst && "pointer-events-none opacity-50")}
          onClick={isFirst ? undefined : onPrev}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("Next page")}
          aria-disabled={isLast}
          className={cn(isLast && "pointer-events-none opacity-50")}
          onClick={isLast ? undefined : onNext}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>
    </div>
  )
}

interface LoadMoreProps {
  remaining: number
  loading: boolean
  onLoadMore: () => void
  total: number
  endLabel?: string
  nextCount?: number
  className?: string
}

function LoadMore({
  remaining,
  loading,
  onLoadMore,
  total,
  endLabel,
  nextCount,
  className,
}: LoadMoreProps) {
  const { t } = useTrans()

  if (remaining <= 0 && !loading) {
    return (
      <div
        data-slot="load-more-end"
        className={cn(
          "flex items-center justify-center gap-1.5 pt-1 text-center text-body-sm text-muted-foreground",
          className
        )}
      >
        <CheckCheckIcon aria-hidden className="size-4 shrink-0" />
        {endLabel ?? t("You're all caught up · :total items", { total })}
      </div>
    )
  }

  return (
    <div
      data-slot="load-more"
      className={cn("flex justify-center p-3", className)}
    >
      <LoadingButton
        variant="outline"
        size="sm"
        loading={loading}
        loader="trema"
        onClick={onLoadMore}
        className="max-w-full min-w-0"
      >
        <span className="truncate">
          {loading ? t("Loading…") : t("Load more")}
        </span>
        {loading ? null : (
          <Badge variant="secondary">
            {t(":count more", { count: Math.min(nextCount ?? remaining, remaining) })}
          </Badge>
        )}
      </LoadingButton>
    </div>
  )
}

function LoadMoreFeed({
  loading = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { loading?: boolean }) {
  return (
    <div
      role="feed"
      aria-busy={loading}
      data-slot="load-more-feed"
      className={className}
      {...props}
    />
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PageSizeBar,
  LoadMore,
  LoadMoreFeed,
}
export type { PaginationProps, PageSizeBarProps, LoadMoreProps }
