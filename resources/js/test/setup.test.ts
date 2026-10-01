import { describe, expect, it } from 'vitest';

describe('test setup', () => {
    it('stubs window.matchMedia so that no media query matches', () => {
        expect(window.matchMedia('(max-width: 767px)').matches).toBe(false);
    });
});
