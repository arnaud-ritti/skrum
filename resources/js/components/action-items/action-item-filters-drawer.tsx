import { CircleAlert, SlidersHorizontal, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import { ActionItemFilterBar } from '@/components/action-items/action-item-filters';
import type { ActionItemCounts } from '@/components/action-items/action-items-header';
import {
    DefaultStatuses,
    isDefaultStatus,
} from '@/components/action-items/use-action-item-filters';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

type Props = ComponentProps<typeof ActionItemFilterBar> & {
    counts: ActionItemCounts;
    /** How many facets narrow the list, said on the button of the drawer. */
    activeCount: number;
};

function Chip({
    label,
    count,
    icon: Icon,
    iconClassName,
    pressed,
    onClick,
}: {
    label: string;
    count?: number;
    icon?: LucideIcon;
    iconClassName?: string;
    pressed: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            data-slot="action-filter-chip"
            aria-pressed={pressed}
            onClick={onClick}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-input bg-card px-3.5 text-sm font-semibold whitespace-nowrap text-foreground outline-ring focus-visible:outline-2 focus-visible:outline-offset-2 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
        >
            {Icon && (
                <Icon
                    aria-hidden
                    className={cn(
                        'size-3.5 shrink-0',
                        !pressed && iconClassName,
                    )}
                />
            )}
            {label}
            {count !== undefined && (
                <span
                    className={cn(
                        'text-xs font-bold tabular-nums',
                        pressed ? 'opacity-75' : 'text-muted-foreground',
                    )}
                >
                    {count}
                </span>
            )}
        </button>
    );
}

/**
 * The filters of a phone: the shortcuts as a row of chips with their
 * numbers, and the facets in a drawer behind "Filters · n".
 */
export function ActionItemFiltersDrawer({
    counts,
    activeCount,
    ...bar
}: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const { filters, onChange } = bar;

    return (
        <div
            data-slot="action-item-filters-phone"
            className="flex min-w-0 flex-col gap-3"
        >
            <div
                role="toolbar"
                aria-label={t('Filters')}
                className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-1"
            >
                <Chip
                    label={t('Mine')}
                    count={counts.mine}
                    icon={User}
                    pressed={filters.assignee === 'me'}
                    onClick={() =>
                        onChange({
                            assignee: filters.assignee === 'me' ? null : 'me',
                        })
                    }
                />
                <Chip
                    label={t('Overdue')}
                    count={counts.overdue}
                    icon={CircleAlert}
                    iconClassName="text-skrum-destructive-text"
                    pressed={filters.due === 'overdue'}
                    onClick={() =>
                        onChange({
                            due: filters.due === 'overdue' ? null : 'overdue',
                        })
                    }
                />
                <Chip
                    label={t('To do')}
                    count={counts.open}
                    pressed={
                        isDefaultStatus(filters.status) &&
                        filters.due !== 'overdue'
                    }
                    onClick={() =>
                        onChange({ status: DefaultStatuses, due: null })
                    }
                />
                <Chip
                    label={t('Done')}
                    pressed={
                        filters.status.length === 1 &&
                        filters.status[0] === 'completed'
                    }
                    onClick={() => onChange({ status: ['completed'] })}
                />
            </div>
            <Button
                type="button"
                variant="outline"
                aria-haspopup="dialog"
                aria-expanded={open}
                className="h-11 max-w-full min-w-0 self-start"
                onClick={() => setOpen(true)}
            >
                <SlidersHorizontal aria-hidden />
                <span className="truncate">
                    {activeCount === 0
                        ? t('Filters')
                        : t('Filters · :count', { count: activeCount })}
                </span>
            </Button>
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerContent
                    aria-describedby={undefined}
                    data-slot="action-item-filters-drawer"
                    className="overflow-y-auto"
                >
                    <DrawerHeader className="pr-10 text-left">
                        <DrawerTitle>{t('Filters')}</DrawerTitle>
                    </DrawerHeader>
                    <ActionItemFilterBar {...bar} layout="stacked" />
                </DrawerContent>
            </Drawer>
        </div>
    );
}
