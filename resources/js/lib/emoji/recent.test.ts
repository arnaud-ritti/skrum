import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushRecent, readRecent } from '@/lib/emoji/recent';

describe('recent emoji', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it('keeps the most recent first without duplicates, capped', () => {
        expect(readRecent()).toEqual([]);

        pushRecent('👍');
        pushRecent('🎉');

        expect(pushRecent('👍')).toEqual(['👍', '🎉']);
        expect(readRecent()).toEqual(['👍', '🎉']);

        for (let code = 0; code < 20; code++) {
            pushRecent(String.fromCodePoint(0x1f600 + code));
        }

        const recent = readRecent();

        expect(recent).toHaveLength(16);
        expect(recent[0]).toBe(String.fromCodePoint(0x1f600 + 19));
        expect(recent).not.toContain('👍');
    });

    it('returns nothing when storage is unavailable', () => {
        const blocked = (): never => {
            throw new Error('blocked');
        };

        vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });

        expect(readRecent()).toEqual([]);
        expect(pushRecent('👍')).toEqual([]);
    });
});
