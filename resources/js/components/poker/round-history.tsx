import { useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import PokerRoundsController from '@/actions/App/Http/Controllers/Poker/PokerRoundsController';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { formatAverage } from '@/lib/poker/format';
import type { PokerRound } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Loaded =
    | { state: 'loading' }
    | { state: 'failed' }
    | { state: 'ready'; rounds: PokerRound[] };

export function RoundHistory({ taskId }: { taskId: string }) {
    const { snapshot, handleError } = useGame();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
    const task = snapshot.tasks.find((candidate) => candidate.id === taskId);
    const currentRound =
        snapshot.current?.taskId === taskId ? snapshot.current.round : null;
    const revision = `${task?.roundsCount ?? 0}:${currentRound?.id ?? ''}:${currentRound?.revealedAt ?? ''}`;
    const gameId = snapshot.game.id;

    useEffect(() => {
        let isCurrent = true;

        retroRequest<PokerRound[]>(
            PokerRoundsController.index({ game: gameId, task: taskId }),
        )
            .then((rounds) => {
                if (isCurrent) {
                    setLoaded({ state: 'ready', rounds });
                }
            })
            .catch((error: unknown) => {
                if (isCurrent) {
                    handleError(error);
                    setLoaded({ state: 'failed' });
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [gameId, taskId, revision, handleError]);

    if (loaded.state === 'loading') {
        return <Skeleton className="h-16 w-full" />;
    }

    if (loaded.state === 'failed') {
        return (
            <p className="text-sm text-destructive">
                {t('Could not load the rounds.')}
            </p>
        );
    }

    if (loaded.rounds.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                {t('No rounds yet.')}
            </p>
        );
    }

    const nameOf = (playerId: string) =>
        snapshot.players.find((player) => player.id === playerId)?.name ??
        t('Former member');

    return (
        <ol className="space-y-3">
            {loaded.rounds.map((round) => (
                <li key={round.id} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">
                        {t('Round :number', { number: round.number })}
                    </div>
                    {round.revealedAt === null ? (
                        <p className="text-muted-foreground">
                            {t('Not revealed · :count votes', {
                                count: round.votesCount,
                            })}
                        </p>
                    ) : (
                        <>
                            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                {round.votes.map((vote) => (
                                    <li key={vote.playerId}>
                                        {nameOf(vote.playerId)}:{' '}
                                        <span className="font-mono font-semibold">
                                            {vote.value ?? '—'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {round.result && (
                                <p className="mt-1 text-muted-foreground">
                                    {round.result.average !== null
                                        ? `${t('Average')}: ${formatAverage(round.result.average, locale)}`
                                        : round.result.mode.length > 0
                                          ? t('Most played: :cards', {
                                                cards: round.result.mode.join(
                                                    ', ',
                                                ),
                                            })
                                          : t('No countable votes')}
                                    {round.result.consensus &&
                                        ` · ${t('Consensus')}`}
                                </p>
                            )}
                        </>
                    )}
                </li>
            ))}
        </ol>
    );
}
