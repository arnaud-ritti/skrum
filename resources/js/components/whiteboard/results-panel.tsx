import { LocateFixed, X } from 'lucide-react';
import { useMemo } from 'react';
import WhiteboardVoteDismissalsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVoteDismissalsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useElementsOnBoard } from '@/hooks/use-whiteboard-overlay';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import type { VoteResult } from '@/lib/whiteboard/types';

type Props = {
    state: WhiteboardState;
    api: ExcalidrawImperativeAPI;
    onClose: () => void;
};

/** Beside the canvas, never over it; results never name a voter. */
export function ResultsPanel({ state, api, onClose }: Props) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const { board, me, voting, votingHistory } = state.snapshot;
    const closed = voting !== null && !voting.open ? voting : null;
    const listed = useMemo(
        () =>
            [
                ...(voting?.results ?? []),
                ...votingHistory.flatMap((past) => past.results),
            ].map((result) => result.elementId),
        [voting?.results, votingHistory],
    );
    // Read from the canvas as it changes: a note deleted here re-renders
    // nothing else in this panel.
    const onBoard = useElementsOnBoard(api, listed);

    const show = (elementId: string) => {
        api.scrollToContent(elementId, { fitToContent: false, animate: true });

        if (window.matchMedia('(max-width: 767px)').matches) {
            onClose();
        }
    };

    const hide = async (sessionId: string) => {
        const done = await request(
            retroRequest(
                WhiteboardVoteDismissalsController.store({
                    board: board.id,
                    voteSession: sessionId,
                }),
            ),
        );

        if (done !== undefined) {
            await state.refetch();
        }
    };

    const list = (results: VoteResult[]) => (
        <ol className="space-y-2">
            {results.map((result, position) => (
                <li
                    key={result.elementId}
                    className="flex items-start gap-2 rounded-md border p-2 text-sm"
                >
                    <span className="font-mono text-muted-foreground">
                        {position + 1}.
                    </span>
                    <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                        {result.text === '' ? t('Empty note') : result.text}
                    </span>
                    <span className="shrink-0 font-medium">
                        {t(
                            result.count === 1 ? ':count vote' : ':count votes',
                            {
                                count: result.count,
                            },
                        )}
                    </span>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0"
                        aria-label={t('Show on the board')}
                        title={
                            onBoard.has(result.elementId)
                                ? t('Show on the board')
                                : t('This note is no longer on the board.')
                        }
                        disabled={!onBoard.has(result.elementId)}
                        onClick={() => show(result.elementId)}
                    >
                        <LocateFixed className="size-4" />
                    </Button>
                </li>
            ))}
        </ol>
    );

    return (
        <aside
            aria-label={t('Vote results')}
            className="w-80 shrink-0 space-y-4 overflow-y-auto border-l bg-background p-4 pb-20 max-md:order-first max-md:max-h-[40dvh] max-md:w-auto max-md:border-b max-md:border-l-0 max-md:pb-4"
        >
            <div className="flex items-center gap-2">
                <h2 className="flex-1 font-medium">{t('Vote results')}</h2>
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('Close')}
                    onClick={onClose}
                >
                    <X className="size-4" />
                </Button>
            </div>
            {closed && (
                <section className="space-y-2">
                    {(closed.results ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No votes were cast.')}
                        </p>
                    ) : (
                        list(closed.results ?? [])
                    )}
                    {me.isFacilitator && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void hide(closed.id)}
                        >
                            {t('Hide the results')}
                        </Button>
                    )}
                </section>
            )}
            {votingHistory.length > 0 && (
                <section className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">
                        {t('Previous votes')}
                    </h3>
                    {votingHistory.map((past) => (
                        <div key={past.id} className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                                {new Date(past.closedAt).toLocaleString()}
                            </p>
                            {list(past.results)}
                        </div>
                    ))}
                </section>
            )}
        </aside>
    );
}
