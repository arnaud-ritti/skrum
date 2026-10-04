import { useState, type FormEvent } from 'react';
import GameWordGuessesController from '@/actions/App/Http/Controllers/Games/GameWordGuessesController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound, GameWordGuessResponse } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

/** Mirrors the server's `max:50` on the whole word. */
const MaxWordLength = 50;

type Props = {
    round: GameRound;
    /** Another player's turn, or a letter on its way. */
    disabled: boolean;
    className?: string;
};

/**
 * Hangman's whole-word guess (spec §6.6, §9.4). Out of turn the field stays
 * focusable, as the letter keyboard does, so the focus never falls to the page. The guesser gets no
 * `game.turn.changed` nor `game.guess.made`, so the response tells the room
 * what the others learn from the broadcasts.
 */
export function HangmanWordGuess({ round, disabled, className }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [missed, setMissed] = useState(false);
    const [shaking, setShaking] = useState(false);
    const label = t('Guess the whole word (+5 pts, −1 life if wrong)');
    const isLocked = disabled || busy;
    const isMyTurn = round.turnPlayerId === ctx.snapshot.me.playerId;
    const [wasMyTurn, setWasMyTurn] = useState(isMyTurn);

    if (isMyTurn !== wasMyTurn) {
        setWasMyTurn(isMyTurn);

        if (isMyTurn) {
            setMissed(false);
        }
    }

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        const word = text.trim();

        if (word === '' || isLocked) {
            return;
        }

        setBusy(true);
        setMissed(false);

        let response: GameWordGuessResponse | undefined;

        try {
            response = await ctx.run(
                retroRequest<GameWordGuessResponse>(
                    GameWordGuessesController.store({
                        room: ctx.snapshot.room.id,
                        round: round.id,
                    }),
                    { text: word },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        setText('');

        if (response.result === 'wrong') {
            setMissed(true);
            setShaking(true);
            ctx.dispatch({
                type: 'guess.added',
                roundId: round.id,
                guess: {
                    id: response.guessId,
                    playerId: ctx.snapshot.me.playerId,
                    text: word,
                },
                misses: response.misses,
            });
            ctx.dispatch({
                type: 'turn.changed',
                turn: {
                    roundId: round.id,
                    turnPlayerId: response.turnPlayerId,
                    turnEndsAt: response.turnEndsAt,
                },
            });
        }

        if (response.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
            void ctx.refetch();
        }
    };

    return (
        <form
            data-slot="hangman-word-guess"
            onSubmit={(event) => void submit(event)}
            className={cn('flex w-full max-w-115 flex-col gap-1.5', className)}
        >
            <div className="flex w-full gap-2">
                <Input
                    value={text}
                    maxLength={MaxWordLength}
                    aria-disabled={disabled || undefined}
                    readOnly={isLocked}
                    autoComplete="off"
                    placeholder={label}
                    aria-label={label}
                    data-shake={shaking}
                    onAnimationEnd={() => setShaking(false)}
                    className={cn(
                        'min-w-0 flex-1 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
                        shaking && 'motion-safe:animate-nudge',
                    )}
                    onChange={(event) => setText(event.target.value)}
                />
                <Button
                    type="submit"
                    variant="secondary"
                    className="shrink-0"
                    disabled={isLocked || text.trim() === ''}
                >
                    {t('Guess')}
                </Button>
            </div>
            <p
                role="status"
                className="text-xs text-skrum-destructive-text empty:sr-only"
            >
                {missed ? t('Missed: −1 life') : ''}
            </p>
        </form>
    );
}
