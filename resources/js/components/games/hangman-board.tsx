import { useState } from 'react';
import GameLettersController from '@/actions/App/Http/Controllers/Games/GameLettersController';
import { useTrans } from '@/hooks/use-trans';
import type { GameLetterResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { HangmanFigure } from './hangman-figure';
import { LetterKeyboard } from './letter-keyboard';
import { useRoom } from './room-context';
import { WordMask } from './word-mask';

export function HangmanBoard({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [pending, setPending] = useState(false);
    const misses = round.misses ?? 0;
    const maxMisses = round.maxMisses ?? 6;
    const names = new Map(
        ctx.snapshot.players.map((player) => [player.id, player.name]),
    );

    const pick = async (letter: string) => {
        setPending(true);

        try {
            const response = await ctx.run(
                retroRequest<GameLetterResponse>(
                    GameLettersController.store({
                        room: ctx.snapshot.room.id,
                        round: round.id,
                    }),
                    { letter },
                ),
            );

            if (!response) {
                return;
            }

            ctx.dispatch({ type: 'letter.picked', picked: response });

            if (response.ended) {
                ctx.dispatch({ type: 'round.ended', ended: response.ended });
                void ctx.refetch();
            }
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
            <HangmanFigure misses={misses} maxMisses={maxMisses} />
            <p className="text-sm text-muted-foreground">
                {t(':count of :max misses', { count: misses, max: maxMisses })}
            </p>
            <WordMask mask={round.mask ?? []} />
            <LetterKeyboard
                picked={round.pickedLetters ?? []}
                disabled={pending}
                onPick={(letter) => void pick(letter)}
            />
            {(round.recentPicks ?? []).length > 0 && (
                <ul
                    aria-label={t('Last letters')}
                    className="flex flex-wrap justify-center gap-2 text-sm"
                >
                    {[...(round.recentPicks ?? [])].reverse().map((recent) => (
                        <li
                            key={`${recent.playerId}-${recent.letter}`}
                            className={cn(
                                'rounded-full border px-2 py-0.5',
                                recent.hit
                                    ? 'border-green-600 text-green-700 dark:text-green-400'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {t(':name picked :letter', {
                                name:
                                    names.get(recent.playerId) ?? t('Someone'),
                                letter: recent.letter.toUpperCase(),
                            })}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
