import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { ActionItemGroupings } from '@/lib/action-items/grouping';
import type { ActionItemGrouping } from '@/lib/action-items/grouping';

export type ActionItemCounts = {
    open: number;
    overdue: number;
    completed: number;
    mine: number;
    rituals: number;
};

/** The two lists the page shows: the current team's, or every team's. */
export type ActionItemsScope = {
    teamName: string;
    teamHref: string;
    allTeamsHref: string;
    onTeam: boolean;
};

type Props = {
    counts: ActionItemCounts;
    grouping: ActionItemGrouping;
    onGroupingChange: (grouping: ActionItemGrouping) => void;
    /** Selection mode of the list below 80rem; the table has its own boxes. */
    selecting?: boolean;
    /** Given below 80rem only: "Select" and "Finish selecting" (spec 24 §9.5). */
    onSelectingChange?: (selecting: boolean) => void;
    /** Absent without a current team: the page is every team's. */
    scope?: ActionItemsScope;
};

/**
 * The title of the page, what is left to do, whose items are listed and how
 * the rows are grouped. The control lists `ActionItemGroupings`, without the
 * team on the list of one team.
 */
export function ActionItemsHeader({
    counts,
    grouping,
    onGroupingChange,
    selecting = false,
    onSelectingChange,
    scope,
}: Props) {
    const { t } = useTrans();
    const groupings = scope?.onTeam
        ? ActionItemGroupings.filter((value) => value !== 'team')
        : ActionItemGroupings;
    const scopes = scope
        ? [
              {
                  label: scope.teamName,
                  href: scope.teamHref,
                  current: scope.onTeam,
              },
              {
                  label: t('All teams'),
                  href: scope.allTeamsHref,
                  current: !scope.onTeam,
              },
          ]
        : [];
    const groupingLabels: Record<ActionItemGrouping, string> = {
        sprint: t('Sprint'),
        team: t('Team'),
        assignee: t('Assignee'),
        none: t('None'),
    };
    const summary = [
        counts.open === 1
            ? t('1 open')
            : t(':count open', { count: counts.open }),
        counts.overdue === 1
            ? t('1 overdue')
            : t(':count overdue', { count: counts.overdue }),
        counts.rituals === 1
            ? t('from 1 ritual')
            : t('from :count rituals', { count: counts.rituals }),
    ].join(' · ');

    return (
        <div
            data-slot="action-items-header"
            className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-3"
        >
            <div className="flex min-w-0 flex-col gap-1">
                <h1 className="font-display text-2xl font-bold tracking-heading">
                    {t('Action items')}
                </h1>
                <p
                    data-slot="action-items-counts"
                    className="text-sm wrap-anywhere text-muted-foreground"
                >
                    {summary}
                </p>
            </div>
            <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
                {scope && (
                    <nav
                        aria-label={t('Teams')}
                        data-slot="action-items-scope"
                        className="inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-lg bg-muted p-0.75"
                    >
                        {scopes.map((option) => (
                            // The page keeps its state: remounted without a
                            // query, it would land on the current team again.
                            <Link
                                key={option.href}
                                href={option.href}
                                preserveState
                                aria-current={
                                    option.current ? 'page' : undefined
                                }
                                className="inline-flex h-7.5 max-w-64 min-w-0 items-center rounded-md px-3 text-body-sm font-semibold text-muted-foreground transition-colors duration-140 ease-out outline-none last:shrink-0 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-card motion-reduce:transition-none"
                            >
                                <span className="truncate">{option.label}</span>
                            </Link>
                        ))}
                    </nav>
                )}
                <div
                    data-slot="action-items-grouping"
                    className="inline-flex max-w-full min-w-0 items-center gap-2"
                >
                    <span
                        aria-hidden
                        className="shrink-0 text-sm whitespace-nowrap text-muted-foreground"
                    >
                        {t('Group by')}
                    </span>
                    <div className="scrollbar-themed flex min-w-0 overflow-x-auto">
                        <ToggleGroup
                            type="single"
                            variant="segmented"
                            aria-label={t('Group by')}
                            value={grouping}
                            onValueChange={onGroupingChange}
                            options={groupings.map((value) => ({
                                value,
                                label: groupingLabels[value],
                            }))}
                            className="shrink-0"
                        />
                    </div>
                </div>
                {onSelectingChange && (
                    <Button
                        type="button"
                        variant={selecting ? 'secondary' : 'outline'}
                        size="sm"
                        data-slot="action-items-select-mode"
                        onClick={() => onSelectingChange(!selecting)}
                    >
                        {selecting ? t('Finish selecting') : t('Select')}
                    </Button>
                )}
            </div>
        </div>
    );
}
