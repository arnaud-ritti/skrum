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
});
