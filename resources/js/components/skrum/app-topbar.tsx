import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { BrandLogo } from '@/components/skrum/brand-logo';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { BrandIdentity } from '@/types';

/**
 * The title takes its width first; the search takes what is left, from 10rem
 * to its full width, so the title is cut only once the search is at its
 * narrowest. A paragraph, not a heading: the page keeps its own. Below the
 * width where the sidebar shows its logo, the bar starts with the instance's
 * mark.
 */
export function AppTopbar({
    title,
    status,
    search,
    actions,
    homeHref,
    brand,
}: {
    title: string;
    /** Where the instance's mark leads on a phone; no mark without it. */
    homeHref?: NavHref;
    brand?: BrandIdentity;
    /** A status of the page (a badge), right after the title. */
    status?: ReactNode;
    search?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            {homeHref !== undefined && (
                <Link
                    href={homeHref}
                    prefetch
                    aria-label={brand?.name ?? 'Skrüm'}
                    data-slot="app-topbar-mark"
                    className="flex max-w-20 shrink-0 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                >
                    <BrandLogo
                        brand={brand}
                        className="h-6"
                        fallback={
                            <SkrumLogo
                                decorative
                                variant="symbol"
                                className="size-6!"
                            />
                        }
                    />
                </Link>
            )}
            <div className="flex min-w-0 items-center gap-3">
                <p
                    data-slot="app-topbar-title"
                    className="truncate text-sm font-medium text-muted-foreground"
                >
                    {title}
                </p>
                {status !== undefined && (
                    <div className="flex shrink-0 items-center">{status}</div>
                )}
            </div>
            {search === undefined ? (
                <div className="flex-1" />
            ) : (
                <div
                    data-slot="app-topbar-search"
                    className="ms-auto flex min-w-0 flex-1 basis-0 justify-end md:max-w-65 md:min-w-40"
                >
                    {search}
                </div>
            )}
            {actions}
        </header>
    );
}
