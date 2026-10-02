import { Flag, Heart } from 'lucide-react';
import { useState } from 'react';
import GameClosuresController from '@/actions/App/Http/Controllers/Games/GameClosuresController';
import GameVotesController from '@/actions/App/Http/Controllers/Games/GameVotesController';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { useTrans } from '@/hooks/use-trans';
import { revealedAnswers } from '@/lib/games/gif';
import type { GameRound, GameRoundEnded } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { GifTile } from './gif-tile';
import { useRoom } from './room-context';

/** Counts stay hidden until the host finishes the round (spec §4.2). */
export function GifVotingStage({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, me, players } = ctx.snapshot;
    const answers = revealedAnswers(round);
    const voters = round.voters ?? [];
    const byId = new Map(players.map((player) => [player.id, player]));
    const total = Math.max(ctx.online.length, voters.length);
    const target = { room: room.id, round: round.id };

    const vote = async (answerId: string) => {
        const retracting = round.myVote === answerId;

        setBusy(true);

        let result: null | undefined;

        try {
            result = await ctx.run(
                retroRequest(
                    retracting
                        ? GameVotesController.destroy(target)
                        : GameVotesController.update(target),
                    retracting ? undefined : { answer_id: answerId },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (result === undefined) {
            return;
        }

        ctx.dispatch({
            type: 'vote.changed',
            roundId: round.id,
            playerId: me.playerId,
            voted: !retracting,
        });
        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: { myVote: retracting ? null : answerId },
        });
    };

    const finish = async () => {
        setBusy(true);

        let response: { ended: GameRoundEnded } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ ended: GameRoundEnded }>(
                    GameClosuresController.store(target),
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        ctx.dispatch({ type: 'round.ended', ended: response.ended });
        void ctx.refetch();
    };

    return (
        <section
            data-slot="gif-voting-stage"
            className="flex w-full flex-col gap-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p aria-live="polite" className="text-sm font-medium">
                    {t(':count of :total voted', {
                        count: voters.length,
                        total,
                    })}
                </p>
                {room.isHost && (
                    <Button disabled={busy} onClick={() => void finish()}>
                        <Flag aria-hidden />
                        {t('Finish round')}
                    </Button>
                )}
            </div>
            {answers.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                    {t('No GIFs yet.')}
                </p>
            ) : (
                <ul
                    data-slot="gif-gallery"
                    className="grid w-full grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] items-start gap-4"
                >
                    {answers.map((answer) => {
                        const isMine = answer.id === round.myAnswer?.id;
                        const isChosen = answer.id === round.myVote;
                        const player =
                            answer.playerId === null
                                ? null
                                : (byId.get(answer.playerId) ?? null);
                        const author =
                            answer.playerId === null
                                ? null
                                : (player?.name ?? t('Someone'));
                        const caption = isMine
                            ? t('Your GIF')
                            : author === null
                              ? t('Anonymous GIF')
                              : t('by :name', { name: author });

                        return (
                            <li key={answer.id} className="min-w-0">
                                <GifTile
                                    gif={answer.gif}
                                    caption={caption}
                                    author={player}
                                    highlight={isChosen}
                                >
                                    {!isMine && (
                                        <div className="flex justify-end">
                                            <Toggle
                                                variant="outline"
                                                size="sm"
                                                pressed={isChosen}
                                                disabled={busy}
                                                className="max-w-full rounded-full"
                                                onPressedChange={() =>
                                                    void vote(answer.id)
                                                }
                                            >
                                                <Heart
                                                    aria-hidden
                                                    className={cn(
                                                        isChosen &&
                                                            'fill-current',
                                                    )}
                                                />
                                                <span className="truncate">
                                                    {isChosen
                                                        ? t('Your favourite')
                                                        : t('Favourite')}
                                                </span>
                                            </Toggle>
                                        </div>
                                    )}
                                </GifTile>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
