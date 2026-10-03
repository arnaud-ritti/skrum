import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import GameLettersController from '@/actions/App/Http/Controllers/Games/GameLettersController';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { hitLetters, keyboardLayoutFor } from '@/lib/games/hangman';
import type { GameLetterResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import {
    dockedPanelClass,
    useHasRightColumn,
    useStageFooter,
} from './game-layout';
import { HangmanFeed } from './hangman-feed';
import { HangmanFigure } from './hangman-figure';
import { HangmanTurnBanner } from './hangman-turn-banner';
import { HangmanWordGuess } from './hangman-word-guess';
import { LetterKeyboard } from './letter-keyboard';
import { useRoom } from './room-context';
import { WordMask } from './word-mask';

/** How many of the last letters stand on the stage where the right column is a sheet. */
const StagePicks = 3;

export function HangmanBoard({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [pending, setPending] = useState(false);
    const hasRightColumn = useHasRightColumn();
    const footer = useStageFooter();
    const misses = round.misses ?? 0;
    const maxMisses = round.maxMisses ?? 6;
    const mask = round.mask ?? [];
    const picked = round.pickedLetters ?? [];
    const hits = hitLetters(mask, picked);
    const missed = picked.filter((letter) => !hits.includes(letter));
    const isOutOfTurn =
        round.turnOrder.length > 0 &&
        round.turnPlayerId !== ctx.snapshot.me.playerId;
    const turnPlayerName =
        ctx.snapshot.players.find((player) => player.id === round.turnPlayerId)
            ?.name ?? t('Someone');

    const pick = async (letter: string) => {
        if (isOutOfTurn) {
            return;
        }

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

    const keyboard = (
        <LetterKeyboard
            layout={keyboardLayoutFor(locale)}
            picked={picked}
            hits={hits}
            disabled={pending}
            disabledReason={
                isOutOfTurn
                    ? t(":name's turn", { name: turnPlayerName })
                    : undefined
            }
            onPick={(letter) => void pick(letter)}
        />
    );
    const wordGuess = (
        <HangmanWordGuess round={round} disabled={pending || isOutOfTurn} />
    );

    return (
        <div
            data-slot="hangman-board"
            className="flex w-full flex-col items-center gap-5"
        >
            <HangmanFigure misses={misses} maxMisses={maxMisses} />
            <div className="-mt-3 flex max-w-full flex-wrap items-center justify-center gap-2">
                <Badge variant="destructive" shape="pill">
                    {t(':count of :max misses', {
                        count: misses,
                        max: maxMisses,
                    })}
                </Badge>
                {missed.length > 0 && (
                    <span
                        data-slot="hangman-missed"
                        className="text-xs text-muted-foreground"
                    >
                        {t('Missed: :letters', {
                            letters: missed.join(', ').toUpperCase(),
                        })}
                    </span>
                )}
            </div>
            <WordMask mask={mask} size="lg" />
            <HangmanTurnBanner round={round} />
            {footer === null && keyboard}
            {footer === null && wordGuess}
            {!hasRightColumn && (
                <HangmanFeed
                    round={round}
                    limit={StagePicks}
                    className="w-full max-w-136"
                />
            )}
            {footer !== null &&
                createPortal(
                    <div
                        data-slot="keyboard-dock"
                        className={cn(
                            'flex flex-col items-center gap-2 bg-muted px-1.5',
                            dockedPanelClass,
                        )}
                    >
                        {wordGuess}
                        {keyboard}
                    </div>,
                    footer,
                )}
        </div>
    );
}
