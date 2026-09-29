import { usePage } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { useTrans } from '@/hooks/use-trans';
import type { Snapshot } from '@/lib/retro/types';

export function CompletedSummary({ board }: { board: Snapshot }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const isMounted = useIsMounted();
    const topCards = board.cards
        .filter((card) => card.parentCardId === null)
        .sort(
            (a, b) =>
                (b.votes ?? 0) - (a.votes ?? 0) || a.position - b.position,
        )
        .slice(0, 5);
    const completedAt =
        isMounted && board.retro.completedAt
            ? new Date(board.retro.completedAt).toLocaleString(locale, {
                  dateStyle: 'long',
                  timeStyle: 'short',
              })
            : null;

    return (
        <section className="space-y-4 border-b p-4">
            {completedAt && (
                <p className="text-sm text-muted-foreground">
                    {t('Retrospective completed on :date', {
                        date: completedAt,
                    })}
                </p>
            )}
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                    <h2 className="text-sm font-semibold">{t('Top topics')}</h2>
                    <ol className="space-y-2">
                        {topCards.map((card) => (
                            <li
                                key={card.id}
                                className="flex items-start justify-between gap-3 rounded-md border p-2 text-sm"
                            >
                                <span className="min-w-0 break-words">
                                    {card.content}
                                </span>
                                <span className="shrink-0 font-medium tabular-nums">
                                    {card.votes ?? 0}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
                <div className="space-y-2">
                    <h2 className="text-sm font-semibold">
                        {t('Action items')}
                    </h2>
                    {board.actionItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No action items yet.')}
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {board.actionItems.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex items-start gap-2 rounded-md border p-2 text-sm"
                                >
                                    {item.isDone && (
                                        <Check
                                            className="mt-0.5 size-4 shrink-0"
                                            aria-label={t('Mark as done')}
                                        />
                                    )}
                                    <span
                                        className={`min-w-0 flex-1 break-words ${item.isDone ? 'text-muted-foreground line-through' : ''}`}
                                    >
                                        {item.content}
                                    </span>
                                    {item.assignee && (
                                        <span className="shrink-0 text-muted-foreground">
                                            {item.assignee.name}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}
