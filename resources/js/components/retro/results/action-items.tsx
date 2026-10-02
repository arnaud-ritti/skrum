import { Link, usePage } from '@inertiajs/react';
import { toActionItemData } from '@/components/action-items/action-item-adapters';
import { ActionItem } from '@/components/skrum/action-item';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { boardActionItemViewer } from '@/lib/action-items/permissions';
import { TrackerLabels } from '@/lib/poker/types';
import { linkedItemsSummary } from '@/lib/retro/session-end';
import { useBoard } from '../board-context';
import { ResultsCard } from './results-card';

/**
 * What the retro leaves behind: its action items, read only, each with its
 * owner, due date, priority and ticket.
 */
export function ActionsCreated() {
    const { board } = useBoard();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const items = board.actionItems;
    const viewer = boardActionItemViewer(board);
    const { linked, tracker, allOwnedAndDated } = linkedItemsSummary(items);
    const notes = [
        linked > 0 &&
            (tracker === null
                ? t(':count linked to a ticket', { count: linked })
                : t(':count linked to :tracker', {
                      count: linked,
                      tracker: TrackerLabels[tracker],
                  })),
        allOwnedAndDated && t('all have an owner and a due date'),
    ].filter((note): note is string => typeof note === 'string');

    return (
        <ResultsCard
            title={t('Actions created')}
            // Narrow: the count stays beside the title and the note takes
            // the line under them.
            asideClassName="contents @lg/card:flex"
            aside={
                <>
                    <Badge
                        variant="muted"
                        shape="pill"
                        data-slot="retro-actions-created-count"
                        className="shrink-0 justify-self-start tabular-nums"
                    >
                        {items.length}
                    </Badge>
                    {notes.length > 0 && (
                        <span
                            data-slot="retro-actions-created-note"
                            className="col-span-2 min-w-0 text-xs text-muted-foreground @lg/card:ml-auto @lg/card:truncate"
                        >
                            {notes.join(' · ')}
                        </span>
                    )}
                </>
            }
        >
            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No action items yet.')}
                </p>
            ) : (
                <div role="list" className="flex min-w-0 flex-col gap-2">
                    {items.map((item) => {
                        const { canComplete: _, ...data } = toActionItemData(
                            item,
                            { locale, viewer, sourceLabel: null },
                        );

                        return (
                            <ActionItem
                                key={item.id}
                                id={`action-item-${item.id}`}
                                {...data}
                                showOwnerName
                                canComplete={false}
                            />
                        );
                    })}
                </div>
            )}
            {board.links.actionItems && (
                <Link
                    href={board.links.actionItems}
                    className="self-start rounded-sm text-sm text-skrum-primary-text underline-offset-4 outline-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    {t("View the team's action items")}
                </Link>
            )}
        </ResultsCard>
    );
}
