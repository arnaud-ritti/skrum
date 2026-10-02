import { describe, expect, it } from 'vitest';
import { markColorClass } from '@/lib/mark-color';

describe('markColorClass', () => {
    it('gives the same column colour to the same id', () => {
        expect(markColorClass('0199a000-0000-7000-8000-000000000021')).toBe(
            markColorClass('0199a000-0000-7000-8000-000000000021'),
        );
    });

    it('always answers one of the eight column colours', () => {
        for (const id of ['', 'a', 'b', 'team-1', 'team-2', 'Ünïcode']) {
            expect(markColorClass(id)).toMatch(
                /^col-(coral|lagoon|iris|moss|apricot|sky|plum|sun)$/,
            );
        }
    });

    it('spreads neighbouring ids over different colours', () => {
        expect(markColorClass('a')).not.toBe(markColorClass('b'));
    });
});
