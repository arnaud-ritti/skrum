import { StatementCount } from './two-truths';
import type { GameKind } from './types';

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

type TitledRound = {
    game: GameKind;
    word: string | null;
    question: string | null;
};

/**
 * How a played round is named in the room's history and in "Games we
 * played" (spec §9.10): its word or its question; a Mood weather round has
 * neither, and a Two truths round never shows its statements there.
 */
export function roundTitle(round: TitledRound, t: Translate): string {
    if (round.game === 'mood') {
        return t('Mood weather');
    }

    if (round.game === 'two_truths') {
        return t(':count statements', { count: StatementCount });
    }

    return round.word ?? round.question ?? '—';
}
