import { CalendarX, CircleDot, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    MultiFacet,
    SingleFacet,
    StackedFacetsProvider,
} from '@/components/action-items/action-item-facets';
import type {
    ActionItemFilterChanges,
    ActionItemFilters,
    StatusToken,
} from '@/components/action-items/use-action-item-filters';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

const Any = 'any';

const EveryStatus: StatusToken[] = ['todo', 'doing', 'completed'];

type FilterAssignee = {
    id: string;
    name: string;
    avatarUrl?: string | null;
};

type Props = {
    filters: ActionItemFilters;
    teams: { id: string; name: string }[];
    assignees: FilterAssignee[];
    overdueCount: number;
    /** The page is as it opens: nothing to reset. */
    isDefault: boolean;
    onChange: (changes: ActionItemFilterChanges) => void;
    onReset: () => void;
    /**
     * The facets after Assignee: priority, due date and source (AI-2). They
     * follow the layout of the bar.
     */
    extraFacets?: ReactNode;
    /** `stacked` is the column of a phone drawer: one facet per line. */
    layout?: 'toolbar' | 'stacked';
};

/**
 * The facets of the list, in the order of the mockup: team, status,
 * assignee, the facets the page adds, then the shortcut to what is overdue.
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
    const overdueOnly = filters.due === 'overdue';

    return (
        <div
            role="group"
            aria-label={t('Filters')}
            data-slot="action-item-filters"
            className={cn(
                'flex min-w-0 gap-2',
                stacked ? 'flex-col items-stretch' : 'flex-wrap items-center',
            )}
        >
            <SingleFacet
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
            </SingleFacet>
            <MultiFacet
                label={t('Status')}
                icon={CircleDot}
                options={[
                    { value: 'todo', label: t('To do') },
                    { value: 'doing', label: t('In progress') },
                    { value: 'completed', label: t('Done status') },
                ]}
                value={filters.status}
                allValue={EveryStatus}
                stacked={stacked}
                onChange={(status) => onChange({ status })}
            />
            <SingleFacet
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
            </SingleFacet>
            <StackedFacetsProvider value={stacked}>
                {extraFacets}
            </StackedFacetsProvider>
            {!stacked && (
                <Separator orientation="vertical" className="mx-0.5 h-5" />
            )}
            <button
                type="button"
                data-slot="action-filter-overdue"
                aria-pressed={overdueOnly}
                onClick={() =>
                    onChange({ due: overdueOnly ? null : 'overdue' })
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
                    onClick={(event) => {
                        // Reset goes away with the opening state: the focus
                        // stays in the filters instead of falling to the page.
                        event.currentTarget
                            .closest<HTMLElement>(
                                '[data-slot="action-item-filters"]',
                            )
                            ?.querySelector<HTMLElement>('[role="combobox"]')
                            ?.focus();
                        onReset();
                    }}
                >
                    <span className="truncate">{t('Reset')}</span>
                </Button>
            )}
        </div>
    );
}
