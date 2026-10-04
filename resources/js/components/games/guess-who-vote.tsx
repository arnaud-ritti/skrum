import { UserRoundSearch } from 'lucide-react';
import { useRef, useState } from 'react';
import GameClosuresController from '@/actions/App/Http/Controllers/Games/GameClosuresController';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupCardItem } from '@/components/ui/radio-group';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound, GameRoundEnded } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';
import { useRoundChoice } from './use-round-choice';

/**
 * The voting stage of Guess who? (spec §9.9): one drawn answer, and everyone
 * but its author names who wrote it. Only a count tells how many voted: a
 * mark per player would name the author, the one who never votes.
 */
export function GuessWhoVote({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, me, players } = ctx.snapshot;
    const drawn = round.drawn ?? null;
    const isAuthor =
        drawn !== null &&
        round.myAnswer !== null &&
        round.myAnswer !== undefined &&
        round.myAnswer.id === drawn.id;
    const byId = new Map(players.map((player) => [player.id, player]));
    const candidates = (round.candidates ?? []).filter(
        (playerId) => playerId !== me.playerId,
    );
    const myChoice = typeof round.myChoice === 'string' ? round.myChoice : null;
    const votedCount = round.votedCount ?? 0;
    /** The count the server holds; my own vote is counted here, not broadcast back. */
    const latestCount = useRef(votedCount);

    latestCount.current = votedCount;

    const choice = useRoundChoice<string>({
        round,
        current: myChoice,
        onSent: (sent, previous) => {
            const nowVoted = sent !== null;

            if (nowVoted === (previous !== null)) {
                return;
            }

            ctx.dispatch({
                type: 'votes.counted',
                counted: {
                    roundId: round.id,
                    voted: Math.max(
                        latestCount.current + (nowVoted ? 1 : -1),
                        0,
                    ),
                },
            });
        },
    });

    const close = async () => {
        setBusy(true);

        let response: { ended: GameRoundEnded } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ ended: GameRoundEnded }>(
                    GameClosuresController.store({
                        room: room.id,
                        round: round.id,
                    }),
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
            data-slot="guess-who-vote"
            className="flex w-full max-w-2xl flex-col gap-4"
        >
            <Card className="p-6">
                <p className="text-lg break-words">{drawn?.text}</p>
            </Card>
            {isAuthor ? (
                <p className="text-sm text-muted-foreground">
                    {t("It's your answer — the others are guessing.")}
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    <h3
                        id="guess-who-question"
                        className="font-display text-xl font-title"
                    >
                        {t('Who wrote this?')}
                    </h3>
                    <RadioGroup
                        aria-labelledby="guess-who-question"
                        value={myChoice ?? ''}
                        className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
                        {...choice.groupProps}
                    >
                        {candidates.map((playerId) => {
                            const player = byId.get(playerId);
                            const name = player?.name ?? t('Someone');

                            return (
                                <RadioGroupCardItem
                                    key={playerId}
                                    value={playerId}
                                    aria-label={name}
                                    aria-disabled={choice.busy || undefined}
                                    onClick={() => choice.choose(playerId)}
                                    className="min-h-11 flex-row items-center gap-3 p-3 aria-disabled:cursor-progress"
                                >
                                    <PersonAvatar
                                        name={name}
                                        src={player?.avatarUrl}
                                        kind={
                                            player?.isGuest ? 'guest' : 'member'
                                        }
                                        size="sm"
                                        decorative
                                    />
                                    <span className="min-w-0 truncate font-medium">
                                        {name}
                                    </span>
                                </RadioGroupCardItem>
                            );
                        })}
                    </RadioGroup>
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p aria-live="polite" className="text-sm font-medium">
                    {t(':count voted', { count: votedCount })}
                </p>
                {room.isHost && (
                    <Button
                        disabled={busy || choice.busy}
                        onClick={() => void close()}
                    >
                        <UserRoundSearch aria-hidden />
                        {t('Show the author')}
                    </Button>
                )}
            </div>
        </section>
    );
}
