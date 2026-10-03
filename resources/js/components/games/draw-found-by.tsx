import { useId } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';
import { findTime, foundByTotal } from '@/lib/games/redo';
import type { GameRound } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

type Props = {
    round: GameRound;
    isLeader: boolean;
    className?: string;
};

/**
 * "Found by · 2 / 5" under the guesses of a Draw & Guess round started with
 * its guessers (spec §6.15, the mockup's `.dr-found`); the drawer also reads
 * what each finder earns them.
 */
export function DrawFoundBy({ round, isLeader, className }: Props) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const headingId = useId();
    const finders = round.finders ?? [];

    if (
        round.guessersTotal === null ||
        round.guessersTotal === undefined ||
        finders.length === 0
    ) {
        return null;
    }

    const players = new Map(
        snapshot.players.map((player) => [player.id, player]),
    );

    return (
        <section
            aria-labelledby={headingId}
            data-slot="draw-found-by"
            className={cn(
                'flex shrink-0 flex-col gap-2 rounded-lg bg-muted p-3',
                className,
            )}
        >
            <h3
                id={headingId}
                className="text-overline text-muted-foreground uppercase"
            >
                {t('Found by · :found / :total', {
                    found: finders.length,
                    total: foundByTotal(finders.length, round.guessersTotal),
                })}
            </h3>
            <ol className="flex flex-col gap-2">
                {finders.map((finder) => {
                    const player = players.get(finder.playerId);
                    const name = player?.name ?? t('Someone');

                    return (
                        <li
                            key={finder.playerId}
                            className="flex min-w-0 items-center gap-2 text-body-sm"
                        >
                            <PersonAvatar
                                name={name}
                                src={player?.avatarUrl ?? null}
                                kind={player?.isGuest ? 'guest' : 'member'}
                                size="xs"
                                decorative
                                className="shrink-0"
                            />
                            <b className="min-w-0 truncate font-semibold">
                                {name}
                            </b>
                            <span className="shrink-0 text-muted-foreground tabular-nums">
                                {findTime(finder.seconds)}
                            </span>
                            <span className="ml-auto shrink-0 text-xs text-skrum-success-text tabular-nums">
                                {t('+:points', { points: finder.points })}
                            </span>
                        </li>
                    );
                })}
            </ol>
            {isLeader && round.pointsPerFinder !== undefined && (
                <p className="text-xs text-muted-foreground">
                    {t('You earn +:points per finder', {
                        points: round.pointsPerFinder,
                    })}
                </p>
            )}
        </section>
    );
}
