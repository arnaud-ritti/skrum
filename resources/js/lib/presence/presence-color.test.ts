import { describe, expect, it } from 'vitest';
import {
    PresenceSlots,
    hashedSlot,
    presenceOf,
    presenceVar,
} from '@/lib/presence/presence-color';

describe('hashedSlot', () => {
    it('gives the same id the same slot every time', () => {
        const id = '0199f3a2-7c1e-7a10-9d5e-3b1f0c2d4e5f';

        expect(hashedSlot(id)).toBe(hashedSlot(id));
    });

    it('stays between 1 and the number of presence colours', () => {
        const ids = Array.from(
            { length: 200 },
            (_, index) => `member-${index}`,
        );
        const slots = ids.map(hashedSlot);

        expect(Math.min(...slots)).toBeGreaterThanOrEqual(1);
        expect(Math.max(...slots)).toBeLessThanOrEqual(PresenceSlots);
        expect(new Set(slots).size).toBe(PresenceSlots);
    });

    it('gives an empty id the first slot', () => {
        expect(hashedSlot('')).toBe(1);
    });
});

describe('presenceOf', () => {
    it('wears the colour the server gives', () => {
        expect(presenceOf({ id: 'x', presence: 7 })).toBe(7);
        expect(presenceOf({ id: 'x', presence: 1 })).toBe(1);
        expect(presenceOf({ id: 'x', presence: 12 })).toBe(12);
    });

    it.each([[0], [13], [null], [undefined], [2.5]])(
        'falls back to the hashed slot for %j',
        (presence) => {
            expect(presenceOf({ id: 'x', presence })).toBe(hashedSlot('x'));
        },
    );

    it('falls back to the hashed slot when no colour is sent', () => {
        expect(presenceOf({ id: 'x' })).toBe(hashedSlot('x'));
    });
});

describe('presenceVar', () => {
    it('names the theme token of the slot', () => {
        expect(presenceVar(3)).toBe('var(--skrum-presence-3)');
    });
});
