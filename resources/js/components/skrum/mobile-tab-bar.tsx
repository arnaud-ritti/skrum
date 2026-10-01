import { Link } from '@inertiajs/react';
import {
    CalendarClock,
    Ellipsis,
    House,
    ListChecks,
    type LucideIcon,
    TrendingUp,
} from 'lucide-react';
import type { NavHref, NavKey } from '@/components/skrum/app-sidebar';
import { useTrans } from '@/hooks/use-trans';

const itemClass =
    'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium text-muted-foreground aria-[current=page]:text-skrum-primary-text';

export function MobileTabBar({
    active,
    links,
    onMore,
}: {
    active?: NavKey;
    links: Partial<Record<NavKey, NavHref>>;
    onMore: () => void;
}) {
    const { t } = useTrans();

    const tabs: { key: NavKey; label: string; icon: LucideIcon }[] = [
        { key: 'dashboard', label: t('Home'), icon: House },
        { key: 'sessions', label: t('Sessions'), icon: CalendarClock },
        { key: 'actions', label: t('Actions'), icon: ListChecks },
        { key: 'mood', label: t('Mood'), icon: TrendingUp },
    ];

    return (
        <nav
            aria-label={t('Navigation')}
            className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
        >
            {tabs.map(({ key, label, icon: Icon }) => {
                const href = links[key];

                if (href === undefined) {
                    return null;
                }

                return (
                    <Link
                        key={key}
                        href={href}
                        aria-current={active === key ? 'page' : undefined}
                        className={itemClass}
                    >
                        <Icon className="size-5" />
                        <span className="max-w-full truncate">{label}</span>
                    </Link>
                );
            })}
            <button type="button" onClick={onMore} className={itemClass}>
                <Ellipsis className="size-5" />
                <span className="max-w-full truncate">{t('More')}</span>
            </button>
        </nav>
    );
}
