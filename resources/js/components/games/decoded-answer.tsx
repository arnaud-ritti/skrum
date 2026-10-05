import { Flame, LockKeyhole, X } from 'lucide-react';
import { useId } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { GameGuessEntry, GameRound } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { GuessField } from './guess-chat';
import { useIsObservingRoom, useRoom } from './room-context';

function Attempt({ guess, label }: { guess: GameGuessEntry; label: string }) {
    const Icon = guess.veryClose ? Flame : X;

    return (
        <li
            data-close={guess.veryClose || undefined}
            className={cn(
                'inline-flex h-7 max-w-full min-w-0 items-center gap-1 rounded-full border bg-card px-2.5 text-xs font-semibold',
                guess.veryClose
                    ? 'border-skrum-warning-text/35 bg-skrum-warning-soft text-skrum-warning-text'
                    : 'text-muted-foreground line-through',
            )}
        >
            <Icon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
        </li>
    );
}

/**
 * Decoded's answer under the puzzle, as its mockup puts it: the field and
 * "Your attempts" of a guesser; the clue giver and an observer read every
 * attempt instead. "Very close" only ever reaches its own guesser.
 */
export function DecodedAnswer({ round }: { round: GameRound }) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const observing = useIsObservingRoom();
    const headingId = useId();
    const isLeader = round.leaderPlayerId === snapshot.me.playerId;
    const guesses = round.guesses ?? [];
    const names = new Map(
        snapshot.players.map((player) => [player.id, player.name]),
    );
    const isGuessing = !isLeader && !observing;
    const shown = isGuessing
        ? guesses.filter((guess) => guess.playerId === snapshot.me.playerId)
        : guesses;
    const heading = isGuessing
        ? t('Your attempts · :count', { count: shown.length })
        : t('Attempts · :count', { count: shown.length });

    return (
        <div
            data-slot="decoded-answer"
            className="flex w-full max-w-2xl flex-col gap-3"
        >
            {isGuessing && <GuessField round={round} />}
            {isLeader && (
                <p className="flex items-center gap-2 rounded-lg border border-dashed border-input p-3 text-body-sm text-muted-foreground">
                    <LockKeyhole aria-hidden className="size-3.5 shrink-0" />
                    <span className="min-w-0">
                        {t('You know the word, so you cannot guess.')}
                    </span>
                </p>
            )}
            {shown.length > 0 && (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                        id={headingId}
                        className="text-sm font-semibold whitespace-nowrap"
                    >
                        {heading}
                    </span>
                    <ul
                        aria-labelledby={headingId}
                        aria-live="polite"
                        className="flex min-w-0 flex-wrap items-center gap-2"
                    >
                        {shown.map((guess) => {
                            if (isGuessing) {
                                return (
                                    <Attempt
                                        key={guess.id}
                                        guess={guess}
                                        label={
                                            guess.veryClose
                                                ? t(':text · almost', {
                                                      text: guess.text,
                                                  })
                                                : guess.text
                                        }
                                    />
                                );
                            }

                            return (
                                <Attempt
                                    key={guess.id}
                                    guess={{ ...guess, veryClose: undefined }}
                                    label={`${names.get(guess.playerId) ?? t('Someone')} · ${guess.text}`}
                                />
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
