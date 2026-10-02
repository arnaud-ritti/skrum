import { CalendarX, CircleDot, UserRound, Users, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
    ActionItemFilterChanges,
    ActionItemFilters,
    StatusFilter,
} from '@/components/action-items/use-action-item-filters';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

const Any = 'any';

export type FilterAssignee = {
    id: string;
    name: string;
    avatarUrl?: string | null;
};

type Props = {
    filters: ActionItemFilters;
    teams: { id: string; name: string }[];
    assignees: FilterAssignee[];
    overdueCount: number;
    /** No facet narrows the list: nothing to reset. */
    isDefault: boolean;
    onChange: (changes: ActionItemFilterChanges) => void;
    onReset: () => void;
    /**
     * Place of the facets a later plan adds after Assignee: priority, due
     * date and source (AI-2).
     */
    extraFacets?: ReactNode;
    /** `stacked` is the column of a phone drawer: one facet per line. */
    layout?: 'toolbar' | 'stacked';
};

function Facet({
    label,
    icon: Icon,
    value,
    placeholder,
    active,
    stacked,
    clearLabel,
    onValueChange,
    onClear,
    children,
}: {
    label: string;
    icon: LucideIcon;
    value: string;
    /** What the trigger reads while the value is none of the options. */
    placeholder?: string;
    active: boolean;
    stacked: boolean;
    clearLabel?: string;
    onValueChange: (value: string) => void;
    onClear?: () => void;
    children: ReactNode;
}) {
    const clearable = active && onClear !== undefined;

    return (
        <div
            data-slot="action-filter"
            data-active={active ? 'true' : undefined}
            className={cn(
                'inline-flex max-w-full min-w-0 items-center rounded-md border border-dashed border-input bg-card text-body-sm font-semibold text-foreground',
                stacked ? 'h-11 w-full' : 'h-8',
                active &&
                    'border-solid border-primary bg-skrum-primary-soft text-skrum-primary-text',
            )}
        >
            <Select value={value} onValueChange={onValueChange}>
                <SelectTrigger
                    size="sm"
                    aria-label={label}
                    className={cn(
                        'h-full min-w-0 flex-1 gap-1.5 border-0 bg-transparent px-2.5 text-body-sm shadow-none data-[placeholder]:text-current data-[size=sm]:h-full',
                        clearable && 'pr-1 [&>svg]:hidden',
                    )}
                >
                    <span className="flex min-w-0 items-center gap-1.5">
                        <Icon
                            aria-hidden
                            className={cn(
                                'size-3.5',
                                active
                                    ? 'text-current'
                                    : 'text-muted-foreground',
                            )}
                        />
                        <span className="truncate">{label}</span>
                        <span
                            className={
                                active
                                    ? 'min-w-0 truncate font-medium'
                                    : 'sr-only'
                            }
                        >
                            <SelectValue placeholder={placeholder} />
                        </span>
                    </span>
                </SelectTrigger>
                <SelectContent align="start">{children}</SelectContent>
            </Select>
            {clearable && (
                <button
                    type="button"
                    aria-label={clearLabel}
                    onClick={onClear}
                    className={cn(
                        'mr-1 inline-flex shrink-0 items-center justify-center rounded-sm outline-ring hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2',
                        stacked ? 'size-9' : 'size-6',
                    )}
                >
                    <X aria-hidden className="size-3.5" />
                </button>
            )}
        </div>
    );
}

/**
 * The facets of the list, in the order of the mockup: team, status,
 * assignee, then the shortcut to what is overdue.
 */
export function ActionItemFilterBar({
    filters,
    teams,
    assignees,
    overdueCount,
    isDefault,
    onChange,
    onReset,
    extraFacets,
    layout = 'toolbar',
}: Props) {
    const { t } = useTrans();
    const stacked = layout === 'stacked';
    const overdueOnly = filters.status === 'overdue';

    return (
        <div
            role="toolbar"
            aria-label={t('Filters')}
            aria-orientation={stacked ? 'vertical' : undefined}
            data-slot="action-item-filters"
            className={cn(
                'flex min-w-0 gap-2',
                stacked ? 'flex-col items-stretch' : 'flex-wrap items-center',
            )}
        >
            <Facet
                label={t('Team')}
                icon={Users}
                value={filters.team ?? Any}
                active={filters.team !== null}
                stacked={stacked}
                clearLabel={t('Show all teams')}
                onValueChange={(team) =>
                    onChange({ team: team === Any ? null : team })
                }
                onClear={() => onChange({ team: null })}
            >
                <SelectItem value={Any}>{t('All teams')}</SelectItem>
                {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                        {team.name}
                    </SelectItem>
                ))}
            </Facet>
            <Facet
                label={t('Status')}
                icon={CircleDot}
                // Overdue is not an option: an empty value lets "To do" be
                // picked again to leave the shortcut.
                value={overdueOnly ? '' : filters.status}
                placeholder={t('To do')}
                active={filters.status !== 'all'}
                stacked={stacked}
                onValueChange={(status) =>
                    onChange({ status: status as StatusFilter })
                }
            >
                <SelectItem value="open">{t('To do')}</SelectItem>
                <SelectItem value="completed">{t('Done')}</SelectItem>
                <SelectItem value="all">{t('All')}</SelectItem>
            </Facet>
            <Facet
                label={t('Assignee')}
                icon={UserRound}
                value={filters.assignee ?? Any}
                active={filters.assignee !== null}
                stacked={stacked}
                onValueChange={(assignee) =>
                    onChange({ assignee: assignee === Any ? null : assignee })
                }
            >
                <SelectItem value={Any}>{t('Anyone')}</SelectItem>
                <SelectItem value="me">{t('Me')}</SelectItem>
                <SelectItem value="unassigned">{t('Unassigned')}</SelectItem>
                {assignees.map((assignee) => (
                    <SelectItem key={assignee.id} value={assignee.id}>
                        {assignee.avatarUrl !== undefined && (
                            <PersonAvatar
                                decorative
                                size="xs"
                                name={assignee.name}
                                src={assignee.avatarUrl}
                            />
                        )}
                        {assignee.name}
                    </SelectItem>
                ))}
            </Facet>
            {extraFacets}
            {!stacked && (
                <Separator orientation="vertical" className="mx-0.5 h-5" />
            )}
            <button
                type="button"
                data-slot="action-filter-overdue"
                aria-pressed={overdueOnly}
                onClick={() =>
                    onChange({ status: overdueOnly ? 'open' : 'overdue' })
                }
                className={cn(
                    'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-body-sm font-semibold text-skrum-destructive-text outline-ring hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 aria-pressed:border-skrum-destructive-text aria-pressed:bg-skrum-destructive-soft',
                    stacked ? 'h-11' : 'h-8',
                )}
            >
                <CalendarX aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{t('Overdue')}</span>
                <Badge
                    variant="destructive"
                    shape="pill"
                    className={cn(
                        'ml-auto tabular-nums',
                        overdueOnly && 'bg-card',
                    )}
                >
                    {overdueCount}
                </Badge>
            </button>
            {!isDefault && (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className={cn('max-w-full min-w-0', !stacked && 'ml-auto')}
                    onClick={onReset}
                >
                    <span className="truncate">{t('Reset')}</span>
                </Button>
            )}
        </div>
    );
}
