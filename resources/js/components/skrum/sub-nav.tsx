import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { cn } from '@/lib/utils';

export type SubNavItem = {
    label: string;
    href: NavHref;
    current: boolean;
    icon?: LucideIcon;
    /**
     * The entry leads to a place of the page in view (`#security`), not to
     * another page: a plain anchor, current as a location.
     */
    inPage?: boolean;
    /** Called when an in-page entry is chosen, before the browser follows it. */
    onSelect?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

const itemClass =
    'group flex min-h-9 max-w-full shrink-0 items-center gap-2.5 rounded-md px-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground data-current:bg-accent data-current:font-semibold data-current:text-accent-foreground lg:min-h-8.5';

export function SubNav({
    items,
    label,
    stuck = false,
}: {
    items: SubNavItem[];
    label: string;
    /**
     * Below `lg` the list stays under the top bar while the page scrolls,
     * for a long page whose entries lead to its own sections.
     */
    stuck?: boolean;
}) {
    const nav = useRef<HTMLElement>(null);
    const currentLabel = items.find((item) => item.current)?.label;

    /** Below `lg` the list scrolls sideways: the entry in use must not stay cut at its edge. */
    useEffect(() => {
        const current = nav.current?.querySelector('[data-current]');

        if (current && typeof current.scrollIntoView === 'function') {
            current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }, [currentLabel]);

    return (
        <nav
            ref={nav}
            aria-label={label}
            data-stuck={stuck ? '' : undefined}
            className={cn(
                'flex gap-0.5 overflow-x-auto lg:sticky lg:top-20 lg:w-54 lg:shrink-0 lg:flex-col lg:self-start lg:overflow-visible',
                stuck &&
                    'max-lg:sticky max-lg:top-14 max-lg:z-20 max-lg:border-b max-lg:bg-background max-lg:py-2',
            )}
        >
            {items.map((item) => {
                const content = (
                    <>
                        {item.icon && (
                            <item.icon
                                aria-hidden="true"
                                data-slot="sub-nav-icon"
                                className="size-4 shrink-0 text-muted-foreground group-data-current:text-skrum-primary-text"
                            />
                        )}
                        <span className="truncate">{item.label}</span>
                    </>
                );

                if (item.inPage && typeof item.href === 'string') {
                    return (
                        <a
                            key={item.label}
                            href={item.href}
                            aria-current={item.current ? 'location' : undefined}
                            data-current={item.current ? '' : undefined}
                            onClick={item.onSelect}
                            className={itemClass}
                        >
                            {content}
                        </a>
                    );
                }

                return (
                    <Link
                        key={item.label}
                        href={item.href}
                        aria-current={item.current ? 'page' : undefined}
                        data-current={item.current ? '' : undefined}
                        className={itemClass}
                    >
                        {content}
                    </Link>
                );
            })}
        </nav>
    );
}
