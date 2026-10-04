import { usePage } from '@inertiajs/react';
import { formatActionDay } from '@/components/skrum/action-item';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type {
    ActionItemGroup,
    ActionItemSprint,
} from '@/lib/action-items/grouping';
import { isOpenStatus } from '@/lib/action-items/status';
import type { ActionItem } from '@/lib/retro/types';

type Translate = ReturnType<typeof useTrans>['t'];

/**
 * A current sprint counts its rows and gives its days; a finished one says
 * how many rows are still to do, carried over; any other count is the
 * group's own.
 */
function sprintSummary(
    sprint: ActionItemSprint,
    items: ActionItem[],
    countLabel: (count: number) => string,
    t: Translate,
    locale: string,
): string {
    const carriedOver = items.filter((item) => isOpenStatus(item.status));

    if (sprint.state === 'finished' && carriedOver.length === 1) {
        return t('1 carried over');
    }

    if (sprint.state === 'finished' && carriedOver.length > 1) {
        return t(':count carried over', { count: carriedOver.length });
    }

    if (sprint.state === 'finished') {
        return countLabel(items.length);
    }

    const days = {
        start: formatActionDay(sprint.startsOn, locale),
        end: formatActionDay(sprint.endsOn, locale),
    };

    return items.length === 1
        ? t('1 action item · :start → :end', days)
        : t(':count action items · :start → :end', {
              count: items.length,
              ...days,
          });
}

/**
 * What follows the label of a group row. A sprint reads as the mockup's
 * "en cours · 6 actions · 22 sept. → 3 oct." or "terminé · 4 actions
 * reportées · 2 en retard"; any other group counts its rows.
 */
export function ActionItemGroupMeta({
    group,
    countLabel,
}: {
    group: ActionItemGroup;
    countLabel: (count: number) => string;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const sprint = group.sprint ?? null;

    if (sprint === null) {
        return (
            <span className="font-medium text-muted-foreground">
                {countLabel(group.items.length)}
            </span>
        );
    }

    const isCurrent = sprint.state === 'current';
    const overdue = group.items.filter(
        (item) => isOpenStatus(item.status) && item.isOverdue,
    ).length;

    return (
        <>
            <Badge variant={isCurrent ? 'info' : 'muted'} shape="pill">
                {isCurrent ? t('In progress') : t('Finished')}
            </Badge>
            <span
                className="font-medium text-muted-foreground"
                title={`${formatActionDay(sprint.startsOn, locale)} → ${formatActionDay(sprint.endsOn, locale)}`}
            >
                {sprintSummary(sprint, group.items, countLabel, t, locale)}
            </span>
            {overdue > 0 && (
                <Badge variant="destructive" shape="pill">
                    {t(':count overdue', { count: overdue })}
                </Badge>
            )}
        </>
    );
}
