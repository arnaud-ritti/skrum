import { Check, X } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

/** The latest moves seen live, newest first: the letters picked and the whole words tried. */
type Props = {
    round: GameRound;
    /** On the stage, under the keyboard: only the latest moves. */
    limit?: number;
    /** h3 on the stage, under its title. */
    heading?: 'h2' | 'h3';
    className?: string;
};

type Move =
    | {
          kind: 'letter';
          key: string;
          playerId: string;
          letter: string;
          hit: boolean;
          seq: number;
      }
    | {
          kind: 'word';
          key: string;
          playerId: string;
          text: string;
          seq: number;
      };

/**
 * Letters and words by arrival. The words of the snapshot have no arrival:
 * they were tried before the viewer came, so they come first.
 */
function movesOf(round: GameRound): Move[] {
    const words: Move[] = (round.wordGuesses ?? []).map((guess, index) => ({
        kind: 'word',
        key: `word-${index}-${guess.playerId}`,
        playerId: guess.playerId,
        text: guess.text,
        seq: guess.seq ?? 0,
    }));
    const letters: Move[] = (round.recentPicks ?? []).map((pick) => ({
        kind: 'letter',
        key: `letter-${pick.playerId}-${pick.letter}`,
        playerId: pick.playerId,
        letter: pick.letter,
        hit: pick.hit,
        seq: pick.seq ?? 0,
    }));

    return [...words, ...letters].sort((a, b) => a.seq - b.seq);
}

export function HangmanFeed({
    round,
    limit,
    heading: Heading = 'h2',
    className,
}: Props) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const moves = movesOf(round).reverse().slice(0, limit);
    const names = new Map(
        snapshot.players.map((player) => [player.id, player.name]),
    );

    if (moves.length === 0) {
        return null;
    }

    return (
        <section className={cn('flex min-w-0 flex-col gap-2', className)}>
            <Heading className="text-sm font-semibold">
                {t('Last moves')}
            </Heading>
            <ul
                aria-label={t('Last moves')}
                aria-live="polite"
                className="flex flex-col gap-2 text-body-sm"
            >
                {moves.map((move) => {
                    const isHit = move.kind === 'letter' && move.hit;
                    const Icon = isHit ? Check : X;
                    const name = names.get(move.playerId) ?? t('Someone');

                    return (
                        <li
                            key={move.key}
                            data-hit={isHit}
                            data-kind={move.kind}
                            className="flex min-w-0 items-start gap-2"
                        >
                            <Icon
                                aria-hidden
                                className={
                                    isHit
                                        ? 'mt-0.5 size-3.5 shrink-0 text-skrum-success-text'
                                        : 'mt-0.5 size-3.5 shrink-0 text-skrum-destructive-text'
                                }
                            />
                            {move.kind === 'word' ? (
                                <span className="min-w-0 break-words">
                                    {t(':name tries :word — missed', {
                                        name,
                                        word: move.text.toUpperCase(),
                                    })}
                                </span>
                            ) : (
                                <span className="min-w-0 break-words">
                                    {t(':name picked :letter', {
                                        name,
                                        letter: move.letter.toUpperCase(),
                                    })}
                                    <span className="sr-only">
                                        {move.hit
                                            ? ` — ${t('in the word')}`
                                            : ` — ${t('not in the word')}`}
                                    </span>
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
