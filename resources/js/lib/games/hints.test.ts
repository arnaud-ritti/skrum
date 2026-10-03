import { describe, expect, it } from 'vitest';
import { nextAutoHintAt } from './hints';

const startedAt = '2026-10-03T10:00:00+00:00';

describe('nextAutoHintAt', () => {
    it('reveals the first letter after one interval', () => {
        expect(nextAutoHintAt(startedAt, 20, 0, 3)).toBe(
            Date.parse(startedAt) + 20_000,
        );
    });

    it('reveals the third letter after three intervals', () => {
        expect(nextAutoHintAt(startedAt, 20, 2, 3)).toBe(
            Date.parse(startedAt) + 60_000,
        );
    });

    it('reveals nothing more once every hint is out', () => {
        expect(nextAutoHintAt(startedAt, 20, 3, 3)).toBeNull();
    });

    it('reveals nothing without an interval', () => {
        expect(nextAutoHintAt(startedAt, null, 0, 3)).toBeNull();
    });

    describe('after a new word', () => {
        const at = (seconds: number) => Date.parse(startedAt) + seconds * 1000;

        it('waits for the next scheduled slot, not the first one', () => {
            expect(
                nextAutoHintAt(startedAt, 20, 0, 4, {
                    hintSlots: 4,
                    now: at(45),
                }),
            ).toBe(at(60));
        });

        it('counts from the letters shown when they are ahead of the clock', () => {
            expect(
                nextAutoHintAt(startedAt, 20, 3, 5, {
                    hintSlots: 5,
                    now: at(45),
                }),
            ).toBe(at(80));
        });

        it('reveals nothing more once the first word slots are spent', () => {
            expect(
                nextAutoHintAt(startedAt, 20, 1, 5, {
                    hintSlots: 3,
                    now: at(61),
                }),
            ).toBeNull();
        });

        it('reveals nothing more past the new word hints', () => {
            expect(
                nextAutoHintAt(startedAt, 20, 2, 2, {
                    hintSlots: 4,
                    now: at(45),
                }),
            ).toBeNull();
        });
    });
});
