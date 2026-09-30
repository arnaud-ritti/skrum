import { Flag, Heart } from 'lucide-react';
import { useState } from 'react';
import GameClosuresController from '@/actions/App/Http/Controllers/Games/GameClosuresController';
import GameVotesController from '@/actions/App/Http/Controllers/Games/GameVotesController';
import { Button } from '@/components/ui/button';
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
    const names = new Map(players.map((player) => [player.id, player.name]));
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
        <section className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
                {t('Vote for your favourite GIF.')}
            </p>
            <p aria-live="polite" className="text-sm font-medium">
                {t(':count of :total voted', {
                    count: voters.length,
                    total,
                })}
            </p>
            <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {answers.map((answer) => {
                    const isMine = answer.id === round.myAnswer?.id;
                    const isChosen = answer.id === round.myVote;
                    const author =
                        answer.playerId === null
                            ? null
                            : (names.get(answer.playerId) ?? t('Someone'));
                    const caption = isMine
                        ? t('Your GIF')
                        : author === null
                          ? t('Anonymous GIF')
                          : t('by :name', { name: author });

                    return (
                        <li key={answer.id}>
                            <GifTile
                                gif={answer.gif}
                                caption={caption}
                                highlight={isChosen}
                            >
                                {!isMine && (
                                    <Button
                                        size="sm"
                                        variant={
                                            isChosen ? 'default' : 'outline'
                                        }
                                        aria-pressed={isChosen}
                                        disabled={busy}
                                        onClick={() => void vote(answer.id)}
                                    >
                                        <Heart
                                            className={cn(
                                                'size-4',
                                                isChosen && 'fill-current',
                                            )}
                                        />
                                        {isChosen
                                            ? t('Your favourite')
                                            : t('Favourite')}
                                    </Button>
                                )}
                            </GifTile>
                        </li>
                    );
                })}
            </ul>
            {answers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('No GIFs yet.')}
                </p>
            )}
            {room.isHost && (
                <Button disabled={busy} onClick={() => void finish()}>
                    <Flag className="size-4" />
                    {t('Finish round')}
                </Button>
            )}
        </section>
    );
}
