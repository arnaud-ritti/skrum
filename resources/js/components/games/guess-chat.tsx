import { LockKeyhole, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import GameGuessesController from '@/actions/App/Http/Controllers/Games/GameGuessesController';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { GameGuessResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

const MaxGuessLength = 50;

type Props = {
    round: GameRound;
    isLeader: boolean;
    /** On the stage of a phone the field comes first, at hand under the game. */
    fieldFirst?: boolean;
    className?: string;
};

/** The guesses of a Draw & Guess or Decoded round, and the field of who may guess. */
export function GuessChat({
    round,
    isLeader,
    fieldFirst = false,
    className,
}: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const log = useRef<HTMLDivElement>(null);
    const guesses = round.guesses ?? [];
    const players = new Map(
        ctx.snapshot.players.map((player) => [player.id, player]),
    );

    useEffect(() => {
        log.current?.scrollTo({ top: log.current.scrollHeight });
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
            data-slot="guess-chat"
            className={cn('flex min-h-0 min-w-0 flex-col gap-3', className)}
        >
            <div className="flex items-baseline justify-between gap-2">
                <h2 id="game-guesses" className="text-base font-title">
                    {t('Guesses')}
                </h2>
                {guesses.length > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                        {guesses.length === 1
                            ? t(':count guess', { count: 1 })
                            : t(':count guesses', { count: guesses.length })}
                    </span>
                )}
            </div>
            <div
                ref={log}
                role="log"
                aria-live="polite"
                aria-labelledby="game-guesses"
                className="min-h-0 flex-1 overflow-y-auto"
            >
                {guesses.length === 0 ? (
                    <p className="text-body-sm text-muted-foreground">
                        {t('No guesses yet.')}
                    </p>
                ) : (
                    <ol className="flex min-h-full flex-col justify-end gap-2.5 px-2">
                        {guesses.map((guess) => {
                            const player = players.get(guess.playerId);
                            const name = player?.name ?? t('Someone');

                            return (
                                <li
                                    key={guess.id}
                                    data-close={guess.veryClose || undefined}
                                    className={cn(
                                        'flex min-w-0 items-start gap-2 text-body-sm',
                                        guess.veryClose &&
                                            '-mx-2 rounded-md bg-skrum-warning-soft px-2 py-1.5',
                                    )}
                                >
                                    <PersonAvatar
                                        name={name}
                                        src={player?.avatarUrl ?? null}
                                        kind={
                                            player?.isGuest ? 'guest' : 'member'
                                        }
                                        size="xs"
                                        decorative
                                        className="shrink-0"
                                    />
                                    <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                                        <b className="font-semibold">{name}</b>
                                        <span className="min-w-0 break-words">
                                            {guess.text}
                                        </span>
                                        {guess.veryClose && (
                                            <Badge
                                                variant="warning"
                                                shape="pill"
                                            >
                                                {t('Very close!')}
                                            </Badge>
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>
            {isLeader ? (
                <p
                    className={cn(
                        'flex items-center gap-2 rounded-lg border border-dashed border-input p-3 text-body-sm text-muted-foreground',
                        fieldFirst && 'order-first',
                    )}
                >
                    <LockKeyhole aria-hidden className="size-3.5 shrink-0" />
                    <span className="min-w-0">
                        {t('You know the word, so you cannot guess.')}
                    </span>
                </p>
            ) : (
                <div
                    className={cn(
                        'flex flex-col gap-1',
                        fieldFirst && 'order-first',
                    )}
                >
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
                            className="min-w-0 flex-1"
                            onChange={(event) => setText(event.target.value)}
                        />
                        <Button
                            type="submit"
                            className="min-w-0 shrink-0"
                            disabled={busy || text.trim() === ''}
                        >
                            <Send aria-hidden />
                            <span className="truncate">{t('Guess')}</span>
                        </Button>
                    </form>
                    <p className="text-xs text-pretty text-muted-foreground">
                        {t(
                            'Enter to send. Only you are told when you are close.',
                        )}
                    </p>
                </div>
            )}
        </section>
    );
}
