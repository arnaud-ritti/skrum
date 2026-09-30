import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { DrawBoard } from './draw-board';
import { HangmanBoard } from './hangman-board';
import { PassRoundButton } from './pass-round-button';

export function GameBoard({ round }: { round: GameRound }) {
    return (
        <div className="flex w-full flex-col items-center gap-4">
            <RoundBody round={round} />
            <div className="flex w-full max-w-5xl justify-end">
                <PassRoundButton round={round} />
            </div>
        </div>
    );
}

/** Keyed by round so live previews and tool state start clean each turn. */
function RoundBody({ round }: { round: GameRound }) {
    const { t } = useTrans();

    switch (round.game) {
        case 'hangman':
            return <HangmanBoard round={round} />;
        case 'draw':
            return <DrawBoard key={round.id} round={round} />;
        default:
            return (
                <p className="text-muted-foreground">
                    {t('This game is not available.')}
                </p>
            );
    }
}
