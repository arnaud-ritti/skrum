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

type Props = {
    counts: ActionItemCounts;
    grouping: ActionItemGrouping;
    onGroupingChange: (grouping: ActionItemGrouping) => void;
};

/**
 * The title of the page, what is left to do, and how the rows are grouped.
 * The control lists `ActionItemGroupings`: a grouping by sprint is one more
 * entry of that list (TM-1).
 */
export function ActionItemsHeader({
    counts,
    grouping,
    onGroupingChange,
}: Props) {
    const { t } = useTrans();
    const groupingLabels: Record<ActionItemGrouping, string> = {
        team: t('Team'),
        assignee: t('Assignee'),
        none: t('None'),
    };
    const summary = [
        counts.open === 1
            ? t('1 open')
            : t(':count open', { count: counts.open }),
        t(':count overdue', { count: counts.overdue }),
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
                <span
                    aria-hidden
                    className="text-sm whitespace-nowrap text-muted-foreground"
                >
                    {t('Group by')}
                </span>
                <ToggleGroup
                    type="single"
                    variant="segmented"
                    aria-label={t('Group by')}
                    value={grouping}
                    onValueChange={onGroupingChange}
                    options={ActionItemGroupings.map((value) => ({
                        value,
                        label: groupingLabels[value],
                    }))}
                />
            </div>
        </div>
    );
}
