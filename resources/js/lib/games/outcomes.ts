import type { GameRoundOutcome } from './types';

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

export function outcomeLabel(outcome: GameRoundOutcome, t: Translate): string {
    switch (outcome) {
        case 'guessed':
            return t('Guessed');
        case 'solved':
            return t('Solved');
        case 'lost':
            return t('Lost');
        case 'timed_out':
            return t("Time's up");
        case 'passed':
            return t('Passed');
        case 'revealed':
            return t('Revealed');
        case 'abandoned':
            return t('Abandoned');
    }
}
