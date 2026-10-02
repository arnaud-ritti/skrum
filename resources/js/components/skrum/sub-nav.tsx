import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import type { NavHref } from '@/components/skrum/app-sidebar';

export type SubNavItem = {
    label: string;
    href: NavHref;
    current: boolean;
    icon?: LucideIcon;
};

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
            className="flex gap-0.5 overflow-x-auto lg:sticky lg:top-20 lg:w-54 lg:shrink-0 lg:flex-col lg:self-start lg:overflow-visible"
        >
            {items.map((item) => (
                <Link
                    key={item.label}
                    href={item.href}
                    aria-current={item.current ? 'page' : undefined}
                    className="group flex min-h-9 max-w-full shrink-0 items-center gap-2.5 rounded-md px-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent-foreground lg:min-h-8.5"
                >
                    {item.icon && (
                        <item.icon
                            aria-hidden="true"
                            data-slot="sub-nav-icon"
                            className="size-4 shrink-0 text-muted-foreground group-aria-[current=page]:text-skrum-primary-text"
                        />
                    )}
                    <span className="truncate">{item.label}</span>
                </Link>
            ))}
        </nav>
    );
}
