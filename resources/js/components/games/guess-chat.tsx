import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import GameGuessesController from '@/actions/App/Http/Controllers/Games/GameGuessesController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { GameGuessResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

const MaxGuessLength = 50;

type Props = { round: GameRound; isLeader: boolean };

export function GuessChat({ round, isLeader }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const list = useRef<HTMLOListElement>(null);
    const guesses = round.guesses ?? [];
    const names = new Map(
        ctx.snapshot.players.map((player) => [player.id, player.name]),
    );

    useEffect(() => {
        list.current?.scrollTo({ top: list.current.scrollHeight });
    }, [guesses.length]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        const guess = text.trim();

        if (guess === '' || busy) {
            return;
        }

        setBusy(true);

        let response: GameGuessResponse | undefined;

        try {
            response = await ctx.run(
                retroRequest<GameGuessResponse>(
                    GameGuessesController.store({
                        room: ctx.snapshot.room.id,
                        round: round.id,
                    }),
                    { text: guess },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        setText('');

        if (response.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
            void ctx.refetch();
            toast.success(t('You found it!'));

            return;
        }

        ctx.dispatch({
            type: 'guess.added',
            roundId: round.id,
            guess: {
                id: response.guessId,
                playerId: ctx.snapshot.me.playerId,
                text: guess,
                ...(response.result === 'near' ? { veryClose: true } : {}),
            },
        });
    };

    return (
        <section
            aria-labelledby="game-guesses"
            className="flex min-h-64 w-full flex-col gap-2 rounded-lg border p-3"
        >
            <h2 id="game-guesses" className="text-sm font-semibold">
                {t('Guesses')}
            </h2>
            <ol
                ref={list}
                aria-live="polite"
                className="max-h-96 flex-1 space-y-1 overflow-y-auto text-sm"
            >
                {guesses.length === 0 && (
                    <li className="text-muted-foreground">
                        {t('No guesses yet.')}
                    </li>
                )}
                {guesses.map((guess) => (
                    <li key={guess.id} className="break-words">
                        <span className="font-medium">
                            {names.get(guess.playerId) ?? t('Someone')}
                        </span>
                        {': '}
                        {guess.text}
                        {guess.veryClose && (
                            <Badge variant="secondary" className="ml-2">
                                {t('Very close!')}
                            </Badge>
                        )}
                    </li>
                ))}
            </ol>
            {isLeader ? (
                <p className="text-sm text-muted-foreground">
                    {t('You know the word, so you cannot guess.')}
                </p>
            ) : (
                <form
                    onSubmit={(event) => void submit(event)}
                    className="flex gap-2"
                >
                    <Input
                        value={text}
                        maxLength={MaxGuessLength}
                        readOnly={busy}
                        autoComplete="off"
                        placeholder={t('Your guess')}
                        aria-label={t('Your guess')}
                        onChange={(event) => setText(event.target.value)}
                    />
                    <Button type="submit" disabled={busy || text.trim() === ''}>
                        {t('Guess')}
                    </Button>
                </form>
            )}
        </section>
    );
}
