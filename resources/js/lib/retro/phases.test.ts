import { describe, expect, it } from 'vitest';
import {
    nextPhase,
    PhaseLabels,
    reopenPhase,
    stepperPhases,
} from '@/lib/retro/phases';
import type { RetroPhase } from '@/lib/retro/types';

const Phases: RetroPhase[] = [
    'icebreaker',
    'writing',
    'grouping',
    'voting',
    'discussing',
    'completed',
];

describe('retro phases', () => {
    it('names every phase, and the health check is not one', () => {
        expect(Object.keys(PhaseLabels)).not.toContain('health_check');
        expect(PhaseLabels.discussing).toBe('Discussing');
        expect(PhaseLabels.completed).toBe('Completed');
    });

    it('keeps the completed state out of the rail', () => {
        expect(stepperPhases(Phases)).toEqual([
            'icebreaker',
            'writing',
            'grouping',
            'voting',
            'discussing',
        ]);
    });

    it('finds the next phase, the completed state after the last one', () => {
        expect(nextPhase(Phases, 'writing')).toBe('grouping');
        expect(nextPhase(Phases, 'discussing')).toBe('completed');
        expect(nextPhase(Phases, 'completed')).toBeNull();
        expect(nextPhase(Phases, 'roti')).toBeNull();
    });

    it('reopens on the last phase before the completed state', () => {
        expect(reopenPhase(Phases)).toBe('discussing');
        expect(reopenPhase(['completed'])).toBeNull();
    });
});
