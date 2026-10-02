import { Check, X } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

/** The latest letters seen live, newest first: who picked what, and whether it is in the word. */
type Props = {
    round: GameRound;
    /** On the stage, under the keyboard: only the latest picks. */
    limit?: number;
    className?: string;
};

export function HangmanFeed({ round, limit, className }: Props) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const picks = [...(round.recentPicks ?? [])].reverse().slice(0, limit);
    const names = new Map(
        snapshot.players.map((player) => [player.id, player.name]),
    );

    if (picks.length === 0) {
        return null;
    }

    return (
        <section className={cn('flex min-w-0 flex-col gap-2', className)}>
            <h2 id="game-last-letters" className="text-sm font-semibold">
                {t('Last letters')}
            </h2>
            <ul
                aria-label={t('Last letters')}
                aria-live="polite"
                className="flex flex-col gap-2 text-body-sm"
            >
                {picks.map((pick) => {
                    const Icon = pick.hit ? Check : X;

                    return (
                        <li
                            key={`${pick.playerId}-${pick.letter}`}
                            data-hit={pick.hit}
                            className="flex min-w-0 items-start gap-2"
                        >
                            <Icon
                                aria-hidden
                                className={
                                    pick.hit
                                        ? 'mt-0.5 size-3.5 shrink-0 text-skrum-success-text'
                                        : 'mt-0.5 size-3.5 shrink-0 text-skrum-destructive-text'
                                }
                            />
                            <span className="min-w-0 break-words">
                                {t(':name picked :letter', {
                                    name:
                                        names.get(pick.playerId) ??
                                        t('Someone'),
                                    letter: pick.letter.toUpperCase(),
                                })}
                                <span className="sr-only">
                                    {pick.hit
                                        ? ` — ${t('in the word')}`
                                        : ` — ${t('not in the word')}`}
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
