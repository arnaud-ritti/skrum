import { Link } from '@inertiajs/react';
import type { NavHref } from '@/components/skrum/app-sidebar';

export type SubNavItem = { label: string; href: NavHref; current: boolean };

export function SubNav({
    items,
    label,
}: {
    items: SubNavItem[];
    label: string;
}) {
    return (
        <nav
            aria-label={label}
            className="flex gap-1 overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible"
        >
            {items.map((item) => (
                <Link
                    key={item.label}
                    href={item.href}
                    aria-current={item.current ? 'page' : undefined}
                    className="min-h-9 max-w-full shrink-0 truncate rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-skrum-primary-soft aria-[current=page]:text-skrum-primary-text"
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
