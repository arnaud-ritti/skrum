import { LockKeyhole, MessagesSquare, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import GameGuessesController from '@/actions/App/Http/Controllers/Games/GameGuessesController';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import type {
    GameGuessEntry,
    GameGuessResponse,
    GameRound,
} from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { dockedPanelClass } from './game-layout';
import { useRoom } from './room-context';

const MaxGuessLength = 50;

type Props = {
    round: GameRound;
    isLeader: boolean;
    /** On the stage of a phone the field comes first, at hand under the game. */
    fieldFirst?: boolean;
    className?: string;
};

function usePlayers() {
    const { snapshot } = useRoom();

    return new Map(snapshot.players.map((player) => [player.id, player]));
}

function guessCount(count: number, t: ReturnType<typeof useTrans>['t']) {
    return count === 1
        ? t(':count guess', { count: 1 })
        : t(':count guesses', { count });
}

type GuessLogProps = {
    round: GameRound;
    /** The id of the heading that names the log; without it the log names itself. */
    labelledBy?: string;
    className?: string;
};

/** What the players proposed, the latest at the bottom and in view. */
function GuessLog({ round, labelledBy, className }: GuessLogProps) {
    const { t } = useTrans();
    const log = useRef<HTMLDivElement>(null);
    const guesses = round.guesses ?? [];
    const players = usePlayers();

    useEffect(() => {
        log.current?.scrollTo?.({ top: log.current.scrollHeight });
    }, [guesses.length]);

    return (
        <div
            ref={log}
            role="log"
            aria-live="polite"
            aria-labelledby={labelledBy}
            aria-label={labelledBy === undefined ? t('Guesses') : undefined}
            className={cn('min-h-0 flex-1 overflow-y-auto', className)}
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
                                    kind={player?.isGuest ? 'guest' : 'member'}
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
                                        <Badge variant="warning" shape="pill">
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
    );
}

/** The field of who may guess; a guess that ends the round says so in a toast. */
function GuessField({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);

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
        <form onSubmit={(event) => void submit(event)} className="flex gap-2">
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
    );
}

/** The guesses of a Draw & Guess or Decoded round, and the field of who may guess. */
export function GuessChat({
    round,
    isLeader,
    fieldFirst = false,
    className,
}: Props) {
    const { t } = useTrans();
    const guesses = round.guesses ?? [];

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
                        {guessCount(guesses.length, t)}
                    </span>
                )}
            </div>
            <GuessLog round={round} labelledBy="game-guesses" />
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
                    <GuessField round={round} />
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

function LastGuess({ guess }: { guess: GameGuessEntry | undefined }) {
    const { t } = useTrans();
    const players = usePlayers();

    if (guess === undefined) {
        return (
            <span className="text-muted-foreground">
                {t('No guesses yet.')}
            </span>
        );
    }

    return (
        <>
            <b className="font-semibold">
                {players.get(guess.playerId)?.name ?? t('Someone')}
            </b>{' '}
            {guess.text}
            {guess.veryClose && (
                <>
                    {' '}
                    <Badge variant="warning" shape="pill">
                        {t('Very close!')}
                    </Badge>
                </>
            )}
        </>
    );
}

/**
 * The guesses of a drawing on a phone: the field docked at the bottom of the
 * screen under the latest guess, and the whole list in a drawer.
 */
export function GuessDock({
    round,
    isLeader,
}: Pick<Props, 'round' | 'isLeader'>) {
    const { t } = useTrans();
    const [isOpen, setIsOpen] = useState(false);
    const restoreFocus = useRestoreFocus(isOpen);
    const guesses = round.guesses ?? [];

    return (
        <div
            data-slot="guess-dock"
            className={cn('flex flex-col gap-2 bg-card px-4', dockedPanelClass)}
        >
            <div className="flex items-center gap-2">
                <p
                    aria-live="polite"
                    data-slot="last-guess"
                    className="min-w-0 flex-1 truncate text-body-sm"
                >
                    <LastGuess guess={guesses.at(-1)} />
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-haspopup="dialog"
                    className="min-w-0 shrink-0"
                    onClick={() => setIsOpen(true)}
                >
                    <MessagesSquare aria-hidden />
                    <span className="truncate">{t('Guesses')}</span>
                    {guesses.length > 0 && (
                        <span
                            aria-hidden
                            className="text-muted-foreground tabular-nums"
                        >
                            {guesses.length}
                        </span>
                    )}
                </Button>
            </div>
            {!isLeader && <GuessField round={round} />}
            <Drawer open={isOpen} onOpenChange={setIsOpen}>
                <DrawerContent onCloseAutoFocus={restoreFocus}>
                    <DrawerHeader className="text-left">
                        <DrawerTitle>{t('Guesses')}</DrawerTitle>
                        <DrawerDescription>
                            {isLeader
                                ? t('You know the word, so you cannot guess.')
                                : t(
                                      'Enter to send. Only you are told when you are close.',
                                  )}
                        </DrawerDescription>
                    </DrawerHeader>
                    {guesses.length > 0 && (
                        <p className="pb-2 text-xs text-muted-foreground">
                            {guessCount(guesses.length, t)}
                        </p>
                    )}
                    <GuessLog round={round} />
                </DrawerContent>
            </Drawer>
        </div>
    );
}
