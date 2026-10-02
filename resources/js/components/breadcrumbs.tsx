import { Link } from '@inertiajs/react';
import { ChevronLeft, Home } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Fragment } from 'react';
import {
    Breadcrumb,
    BreadcrumbEllipsis,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

type BreadcrumbEntry = BreadcrumbItemType & {
    icon?: LucideIcon;
};

type BreadcrumbsProps = {
    breadcrumbs: BreadcrumbEntry[];
    maxItems?: number;
    separator?: 'chevron' | 'slash';
    collapseOnMobile?: boolean;
    homeIcon?: boolean;
    className?: string;
};

const DefaultMaxItems = 4;

export function Breadcrumbs({
    breadcrumbs,
    maxItems = DefaultMaxItems,
    separator = 'chevron',
    collapseOnMobile = false,
    homeIcon = false,
    className,
}: BreadcrumbsProps) {
    const { t } = useTrans();

    if (breadcrumbs.length === 0) {
        return null;
    }

    const visibleLimit = Math.max(maxItems, 2);
    const isCollapsed = breadcrumbs.length > visibleLimit;
    const hiddenEnd = isCollapsed ? breadcrumbs.length - (visibleLimit - 2) : 0;
    const hiddenItems = isCollapsed ? breadcrumbs.slice(1, hiddenEnd) : [];
    const lastIndex = breadcrumbs.length - 1;
    const parent = breadcrumbs.length > 1 ? breadcrumbs[lastIndex - 1] : null;
    const current = breadcrumbs[lastIndex];

    function renderCrumb(item: BreadcrumbEntry, index: number) {
        const title = t(item.title);
        const isLast = index === lastIndex;
        const isHome = homeIcon && index === 0;
        const Icon = isHome ? (item.icon ?? Home) : item.icon;

        const content = (
            <>
                {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                <span className={cn('truncate', isHome && 'sr-only')}>
                    {title}
                </span>
            </>
        );

        if (isLast) {
            return (
                <BreadcrumbPage
                    title={title}
                    className="inline-flex min-w-0 items-center gap-1.5"
                >
                    {content}
                </BreadcrumbPage>
            );
        }

        return (
            <BreadcrumbLink
                asChild
                className="inline-flex max-w-48 min-w-0 items-center gap-1.5"
            >
                <Link href={item.href} title={title}>
                    {content}
                </Link>
            </BreadcrumbLink>
        );
    }

    function renderSeparator() {
        return (
            <BreadcrumbSeparator className="shrink-0">
                {separator === 'slash' ? '/' : undefined}
            </BreadcrumbSeparator>
        );
    }

    const desktopList = (
        <BreadcrumbList
            className={cn('flex-nowrap', collapseOnMobile && 'hidden md:flex')}
        >
            {breadcrumbs.map((item, index) => {
                if (isCollapsed && index > 0 && index < hiddenEnd) {
                    if (index !== 1) {
                        return null;
                    }

                    return (
                        <Fragment key="ellipsis">
                            <BreadcrumbItem className="shrink-0">
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        className="rounded-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                        aria-label={t('Show full path')}
                                    >
                                        <BreadcrumbEllipsis />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        {hiddenItems.map(
                                            (hidden, hiddenIndex) => (
                                                <DropdownMenuItem
                                                    key={`${hiddenIndex}-${hidden.title}`}
                                                    asChild
                                                >
                                                    <Link href={hidden.href}>
                                                        <span className="truncate">
                                                            {t(hidden.title)}
                                                        </span>
                                                    </Link>
                                                </DropdownMenuItem>
                                            ),
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </BreadcrumbItem>
                            {renderSeparator()}
                        </Fragment>
                    );
                }

                const isLast = index === lastIndex;

                return (
                    <Fragment key={index}>
                        <BreadcrumbItem className="min-w-0">
                            {renderCrumb(item, index)}
                        </BreadcrumbItem>
                        {!isLast && renderSeparator()}
                    </Fragment>
                );
            })}
        </BreadcrumbList>
    );

    return (
        <Breadcrumb
            aria-label={t('Breadcrumb')}
            className={cn('min-w-0', className)}
        >
            {desktopList}
            {collapseOnMobile && (
                <div
                    data-slot="breadcrumb-mobile"
                    className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground md:hidden"
                >
                    {parent && (
                        <Link
                            href={parent.href}
                            aria-label={t('Back to :title', {
                                title: t(parent.title),
                            })}
                            className="inline-flex size-6 shrink-0 items-center justify-center rounded-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <ChevronLeft className="size-4" aria-hidden />
                        </Link>
                    )}
                    <span
                        aria-current="page"
                        title={t(current.title)}
                        className="min-w-0 truncate font-semibold text-foreground"
                    >
                        {t(current.title)}
                    </span>
                </div>
            )}
        </Breadcrumb>
    );
}
