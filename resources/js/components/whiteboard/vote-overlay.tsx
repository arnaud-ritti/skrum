import { Minus, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { useCanvasView, useNoteBoxes } from '@/hooks/use-whiteboard-overlay';
import { cn } from '@/lib/utils';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import type { WhiteboardVoting } from '@/lib/whiteboard/types';

type Props = {
    api: ExcalidrawImperativeAPI;
    voting: WhiteboardVoting;
    onVote: (elementId: string, count: number) => void;
};

const controlButton =
    'flex size-6 items-center justify-center rounded-full hover:bg-accent disabled:opacity-40';

/**
 * Vote controls while the vote is open, count badges once it is closed,
 * anchored to the top-right corner of each note. Sits above the drawing and
 * under the canvas's own controls (z-index 3, between the canvas layers at
 * 1–2 and its interface at 4).
 */
export function VoteOverlay({ api, voting, onVote }: Props) {
    const { t } = useTrans();
    const view = useCanvasView(api);
    const ids = useMemo(
        () =>
            voting.open
                ? voting.elementIds
                : (voting.results ?? []).map((result) => result.elementId),
        [voting.open, voting.elementIds, voting.results],
    );
    const boxes = useNoteBoxes(api, ids);

    if (!view) {
        return null;
    }

    const mine = new Map(
        voting.myVotes.map((vote) => [vote.elementId, vote.count]),
    );
    const totals = new Map(
        (voting.results ?? []).map((result) => [
            result.elementId,
            result.count,
        ]),
    );

    return (
        <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
            {boxes.map((box) => {
                const count = mine.get(box.id) ?? 0;
                const total = totals.get(box.id) ?? 0;

                return (
                    <div
                        key={box.id}
                        className="absolute -translate-x-full -translate-y-1/2"
                        style={{
                            left:
                                (box.x + box.width + view.scrollX) * view.zoom,
                            top: (box.y + view.scrollY) * view.zoom,
                        }}
                    >
                        {!voting.open && (
                            <span
                                className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm"
                                aria-label={t(
                                    total === 1
                                        ? ':count vote'
                                        : ':count votes',
                                    { count: total },
                                )}
                            >
                                {total}
                            </span>
                        )}
                        {voting.open && voting.allowMultiple && (
                            <span className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-background p-0.5 text-xs shadow-sm">
                                <button
                                    type="button"
                                    className={controlButton}
                                    aria-label={t('Remove a vote')}
                                    disabled={count === 0}
                                    onClick={() => onVote(box.id, count - 1)}
                                >
                                    <Minus className="size-3" />
                                </button>
                                <span
                                    className="min-w-4 text-center font-medium"
                                    aria-label={t('Your votes: :count', {
                                        count,
                                    })}
                                >
                                    {count}
                                </span>
                                <button
                                    type="button"
                                    className={controlButton}
                                    aria-label={t('Add a vote')}
                                    disabled={voting.remaining === 0}
                                    onClick={() => onVote(box.id, count + 1)}
                                >
                                    <Plus className="size-3" />
                                </button>
                            </span>
                        )}
                        {voting.open && !voting.allowMultiple && (
                            <button
                                type="button"
                                className={cn(
                                    'pointer-events-auto flex size-6 items-center justify-center rounded-full border bg-background text-xs font-medium shadow-sm disabled:opacity-40',
                                    count === 1 &&
                                        'border-primary bg-primary text-primary-foreground',
                                )}
                                aria-pressed={count === 1}
                                aria-label={t('Vote for this note')}
                                disabled={count === 0 && voting.remaining === 0}
                                onClick={() =>
                                    onVote(box.id, count === 1 ? 0 : 1)
                                }
                            >
                                {count === 1 ? (
                                    '1'
                                ) : (
                                    <Plus className="size-3" />
                                )}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
