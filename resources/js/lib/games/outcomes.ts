import type { Translate } from '@/hooks/use-trans';
import type { GameRoundOutcome } from './types';

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
        case 'finished':
            return t('Everyone has spoken');
    }
}
