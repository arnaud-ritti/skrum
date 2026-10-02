import { describe, expect, it } from 'vitest';
import { showsRetroCursors } from '@/components/retro/board-cursors';

describe('showsRetroCursors', () => {
    it('follows the setting', () => {
        expect(
            showsRetroCursors({ cursorsEnabled: true, phase: 'writing' }),
        ).toBe(true);
        expect(
            showsRetroCursors({ cursorsEnabled: false, phase: 'writing' }),
        ).toBe(false);
    });

    it('is on in Actions and off in ROTI, where a pointer on a score would reveal a vote', () => {
        expect(
            showsRetroCursors({ cursorsEnabled: true, phase: 'actions' }),
        ).toBe(true);
        expect(showsRetroCursors({ cursorsEnabled: true, phase: 'roti' })).toBe(
            false,
        );
    });

    it('is off while voting, where a pointer would reveal a vote, and once completed', () => {
        expect(
            showsRetroCursors({ cursorsEnabled: true, phase: 'voting' }),
        ).toBe(false);
        expect(
            showsRetroCursors({ cursorsEnabled: true, phase: 'completed' }),
        ).toBe(false);
        expect(
            showsRetroCursors({ cursorsEnabled: true, phase: 'discussing' }),
        ).toBe(true);
    });
});
