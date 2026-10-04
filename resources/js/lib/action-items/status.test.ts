import { describe, expect, it } from 'vitest';
import { isOpenStatus } from '@/lib/action-items/status';

describe('isOpenStatus', () => {
    it('counts to do and in progress as open', () => {
        expect(isOpenStatus('open')).toBe(true);
        expect(isOpenStatus('doing')).toBe(true);
        expect(isOpenStatus('completed')).toBe(false);
    });
});
