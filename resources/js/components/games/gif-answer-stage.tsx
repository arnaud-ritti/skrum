import { Eye } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import GameGifsController from '@/actions/App/Http/Controllers/Games/GameGifsController';
import GameRevealsController from '@/actions/App/Http/Controllers/Games/GameRevealsController';
import { useGifSearch } from '@/components/gifs/use-gif-search';
import { GifPicker } from '@/components/skrum/gif-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { myGifAnswer } from '@/lib/games/gif';
import type { GameGifSearchResult, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useHasRightColumn } from './game-layout';
import { useGifDraft } from './gif-draft';
import { GifYourPick } from './gif-your-pick';
import { useRoom } from './room-context';

type Props = {
    round: GameRound;
    /** Place left under the chosen GIF for its caption (GM-3). */
    caption?: ReactNode;
};

const noop = (): void => {};

/**
 * The picker stands open on the stage; a pick is a draft until it is sent
 * from "Your pick", which the right column holds where there is one.
 */
export function GifAnswerStage({ round, caption }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const hasRightColumn = useHasRightColumn();
    const { draft, pick, pickerRef } = useGifDraft(round.id);
    const pickRef = useRef<HTMLDivElement>(null);
    const [busy, setBusy] = useState(false);
    const { room } = ctx.snapshot;
    const roomId = room.id;
    const provider = round.gifProvider ?? null;
    /** A draft is not an answer: the reveal would leave its player out of the gallery. */
    const hasUnsentDraft =
        draft !== null && draft.id !== myGifAnswer(round)?.gif.id;

    const search = useCallback(
        (query: string) =>
            retroRequest<{ gifs: GameGifSearchResult[] }>(
                GameGifsController.index(roomId, { query: { q: query } }),
            ),
        [roomId],
    );
    const { results, status, setQuery, retry } = useGifSearch(
        search,
        provider !== null,
    );

    const reveal = async () => {
        setBusy(true);

        let revealed: GameRound | undefined;

        try {
            revealed = await ctx.run(
                retroRequest<GameRound>(
                    GameRevealsController.store({
                        room: roomId,
                        round: round.id,
                    }),
                ),
            );
        } finally {
            setBusy(false);
        }

        if (revealed) {
            ctx.dispatch({
                type: 'round.patched',
                roundId: round.id,
                patch: revealed,
            });
        }
    };

    return (
        <div
            data-slot="gif-answer-stage"
            className="flex w-full max-w-160 flex-col gap-4"
        >
            <div ref={pickerRef} className="flex min-w-0">
                <GifPicker
                    open
                    inline
                    results={results}
                    provider={provider ?? undefined}
                    status={provider === null ? 'disabled' : status}
                    selectedId={draft?.id ?? myGifAnswer(round)?.gif.id}
                    onOpenChange={noop}
                    onSelect={(gif) => {
                        pick({ id: gif.id, previewUrl: gif.previewUrl });

                        if (!hasRightColumn) {
                            requestAnimationFrame(() =>
                                pickRef.current?.scrollIntoView?.({
                                    block: 'nearest',
                                }),
                            );
                        }
                    }}
                    onQueryChange={setQuery}
                    onRetry={retry}
                />
            </div>
            {!hasRightColumn && (
                <Card ref={pickRef} className="p-4">
                    <GifYourPick round={round} heading="h3" caption={caption} />
                </Card>
            )}
            {room.isHost && (
                <div className="flex flex-col items-center gap-2">
                    <Button
                        variant="secondary"
                        disabled={busy}
                        aria-describedby={
                            hasUnsentDraft ? 'gif-unsent-draft' : undefined
                        }
                        onClick={() => void reveal()}
                    >
                        <Eye aria-hidden />
                        {t('Reveal the GIFs')}
                    </Button>
                    <p
                        role="status"
                        className="text-center text-sm text-skrum-warning-text empty:hidden"
                    >
                        {hasUnsentDraft && (
                            <span id="gif-unsent-draft">
                                {t(
                                    'Your GIF is not sent yet: send it before the reveal.',
                                )}
                            </span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}
