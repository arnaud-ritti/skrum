import { Link } from '@inertiajs/react';
import {
    CalendarClock,
    Ellipsis,
    House,
    ListChecks,
    type LucideIcon,
    Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavHref, NavKey } from '@/components/skrum/app-sidebar';
import { buttonVariants } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

const itemClass =
    'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium text-muted-foreground aria-[current=page]:text-skrum-primary-text';

export function MobileTabBar({
    active,
    links,
    newSessionHref,
    liveSessions = 0,
    onMore,
    moreOpen = false,
}: {
    active?: NavKey;
    links: Partial<Record<NavKey, NavHref>>;
    /** Where the centre button leads; absent for a viewer who may create none. */
    newSessionHref?: NavHref;
    liveSessions?: number;
    onMore: () => void;
    moreOpen?: boolean;
}) {
    const { t } = useTrans();

    const tab = (key: NavKey, label: string, Icon: LucideIcon) => {
        const href = links[key];

        if (href === undefined) {
            return null;
        }

        const isLive = key === 'sessions' && liveSessions > 0;

        return (
            <Link
                href={href}
                aria-label={
                    isLive
                        ? `${label}, ${t(':count live', { count: liveSessions })}`
                        : undefined
                }
                aria-current={active === key ? 'page' : undefined}
                className={itemClass}
            >
                <span className="relative">
                    <Icon className="size-5" />
                    {isLive && (
                        <span
                            aria-hidden
                            data-slot="live-dot"
                            className="absolute -top-0.5 -right-1 size-2 rounded-full bg-skrum-success"
                        />
                    )}
                </span>
                <span className="max-w-full truncate">{label}</span>
            </Link>
        );
    };

    return (
        <nav
            aria-label={t('Tab bar')}
            className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
        >
            {tab('dashboard', t('Home'), House)}
            {tab('sessions', t('Sessions'), CalendarClock)}
            {newSessionHref !== undefined && (
                <Link
                    href={newSessionHref}
                    aria-label={t('New session')}
                    className={cn(
                        buttonVariants({ size: 'icon-lg' }),
                        'mx-2 my-1 shrink-0 self-center rounded-full',
                    )}
                >
                    <Plus className="size-5" />
                </Link>
            )}
            {tab('actions', t('Actions'), ListChecks)}
            <button
                type="button"
                onClick={onMore}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                className={itemClass}
            >
                <Ellipsis className="size-5" />
                <span className="max-w-full truncate">{t('More')}</span>
            </button>
        </nav>
    );
}
