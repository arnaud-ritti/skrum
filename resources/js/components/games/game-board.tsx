import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { HangmanBoard } from './hangman-board';

export function GameBoard({ round }: { round: GameRound }) {
    const { t } = useTrans();

    switch (round.game) {
        case 'hangman':
            return <HangmanBoard round={round} />;
        default:
            return (
                <p className="text-muted-foreground">
                    {t('This game is not available.')}
                </p>
            );
    }
}
