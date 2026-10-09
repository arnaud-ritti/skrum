import { useState } from 'react';
import GameUndercoverController from '@/actions/App/Http/Controllers/Games/GameUndercoverController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import type {
    GameRound,
    GameRoundEnded,
    UndercoverResultInfo,
} from '@/lib/games/types';
import { retroRequest, RetroRequestError } from '@/lib/retro/api';
import { useIsObservingRoom, useRoom } from './room-context';

export function UndercoverBoard({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const observing = useIsObservingRoom();
    const state = round.undercover;
    const { room, me, players } = ctx.snapshot;
    if (!state) return null;
    const eliminatedIds = new Set(
        state.eliminated.map((player) => player.playerId),
    );
    const active =
        state.playerIds.includes(me.playerId) &&
        !eliminatedIds.has(me.playerId) &&
        !observing;
    const name = (id: string) =>
        players.find((player) => player.id === id)?.name ?? t('Someone');
    const canAdvance = !observing && room.isHost;
    const advanceLabel =
        state.stage === 'clues'
            ? t('Next')
            : state.stage === 'discussion'
              ? t('Open voting')
              : t('Close voting');

    const play = async (
        action: 'advance' | 'vote' | 'retract',
        choice?: string,
    ) => {
        setBusy(true);
        try {
            const route = {
                advance: GameUndercoverController.store,
                vote: GameUndercoverController.update,
                retract: GameUndercoverController.destroy,
            }[action]({ room: room.id, round: round.id });
            const result = await ctx.run(
                retroRequest<{ ended: GameRoundEnded | null }>(route, {
                    version: state.version,
                    ...(choice ? { choice } : {}),
                }).catch((error: unknown) => {
                    if (
                        error instanceof RetroRequestError &&
                        error.status === 409
                    ) {
                        return undefined;
                    }
                    throw error;
                }),
            );
            if (result?.ended)
                ctx.dispatch({ type: 'round.ended', ended: result.ended });
            await ctx.refetch();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="flex w-full max-w-2xl flex-col gap-4"
            data-slot="undercover-board"
        >
            <p className="text-sm text-muted-foreground">
                {t(
                    'Give a clue aloud without saying your word. Find the players with a different word.',
                )}
            </p>
            {state.myWord !== null && (
                <Card
                    data-slot="undercover-secret"
                    className="items-center gap-3 p-5 text-center"
                >
                    <p className="text-sm font-medium">
                        {t('Your secret word')}
                    </p>
                    <p className="font-display text-2xl font-bold break-words">
                        {visible ? state.myWord : '••••••'}
                    </p>
                    <Button
                        variant="outline"
                        aria-pressed={visible}
                        onClick={() => setVisible(!visible)}
                    >
                        {visible ? t('Hide word') : t('Show word')}
                    </Button>
                </Card>
            )}
            {!state.playerIds.includes(me.playerId) && (
                <p>{t('You will play in the next round.')}</p>
            )}
            {eliminatedIds.has(me.playerId) && (
                <p>{t('You are eliminated. Watch the rest of the game.')}</p>
            )}
            <Card className="gap-4 p-5">
                <p role="status" aria-live="polite" className="font-semibold">
                    {t('Cycle :count', { count: state.cycle })} ·{' '}
                    {state.stage === 'clues'
                        ? t('Give clues')
                        : state.stage === 'discussion'
                          ? t('Discuss together')
                          : t('Vote to eliminate a player')}
                </p>
                {state.stage === 'clues' && round.turnPlayerId && (
                    <p>
                        {t(':name is speaking', {
                            name: name(round.turnPlayerId),
                        })}
                    </p>
                )}
                <ol aria-label={t('Players')} className="flex flex-col gap-2">
                    {state.playerIds.map((id) => {
                        const eliminated = state.eliminated.find(
                            (player) => player.playerId === id,
                        );
                        return (
                            <li
                                key={id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted p-3"
                            >
                                <span className="min-w-0 break-words">
                                    {name(id)}
                                </span>
                                {eliminated && (
                                    <Badge variant="secondary">
                                        {t('Eliminated')} ·{' '}
                                        {eliminated.role === 'civilian'
                                            ? t('Civilian')
                                            : t('Undercover')}
                                    </Badge>
                                )}
                                {state.stage === 'voting' &&
                                    active &&
                                    id !== me.playerId &&
                                    state.candidates.includes(id) && (
                                        <Button
                                            size="sm"
                                            variant={
                                                state.myVote === id
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                            aria-label={t('Vote for :name', {
                                                name: name(id),
                                            })}
                                            aria-pressed={state.myVote === id}
                                            disabled={busy}
                                            onClick={() =>
                                                void play('vote', id)
                                            }
                                        >
                                            {state.myVote === id
                                                ? t('Your vote')
                                                : t('Vote')}
                                        </Button>
                                    )}
                            </li>
                        );
                    })}
                </ol>
                {state.stage === 'voting' && (
                    <>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                state.votedCount === 1
                                    ? ':count vote received'
                                    : ':count votes received',
                                {
                                    count: state.votedCount,
                                },
                            )}
                        </p>
                        {state.candidates.length <
                            state.playerIds.length -
                                state.eliminated.length && (
                            <p>
                                {t('Tie: vote again between the tied players.')}
                            </p>
                        )}
                        {active && state.myVote && (
                            <Button
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void play('retract')}
                            >
                                {t('Cancel my vote')}
                            </Button>
                        )}
                    </>
                )}
                {canAdvance && (
                    <Button
                        disabled={
                            busy ||
                            (state.stage === 'voting' && state.votedCount === 0)
                        }
                        onClick={() => void play('advance')}
                    >
                        {advanceLabel}
                    </Button>
                )}
            </Card>
        </div>
    );
}

export function UndercoverResult({ result }: { result: UndercoverResultInfo }) {
    const { snapshot } = useRoom();
    return (
        <UndercoverSummary
            result={result}
            names={
                new Map(
                    snapshot.players.map((player) => [player.id, player.name]),
                )
            }
        />
    );
}

export function UndercoverSummary({
    result,
    names,
}: {
    result: UndercoverResultInfo;
    names: Map<string, string>;
}) {
    const { t } = useTrans();
    return (
        <div
            className="flex w-full flex-col gap-3"
            data-slot="undercover-result"
        >
            {result.winner && (
                <h3 className="font-display text-xl font-title">
                    {result.winner === 'civilian'
                        ? t('The civilians win!')
                        : t('The Undercover win!')}
                </h3>
            )}
            <p className="break-words">
                {t('Civilian')}: <strong>{result.words.civilian}</strong> ·{' '}
                {t('Undercover')}: <strong>{result.words.undercover}</strong>
            </p>
            <ul className="flex flex-col gap-1 text-sm">
                {result.players.map((player) => (
                    <li key={player.playerId} className="break-words">
                        {names.get(player.playerId) ?? t('Someone')} ·{' '}
                        {player.role === 'civilian'
                            ? t('Civilian')
                            : t('Undercover')}
                        {player.eliminated && ` · ${t('Eliminated')}`}
                    </li>
                ))}
            </ul>
        </div>
    );
}
