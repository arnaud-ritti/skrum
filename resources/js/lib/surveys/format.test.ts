import { afterEach, describe, expect, it } from 'vitest';
import { formatDecimal, formatPercent } from './format';

afterEach(() => {
    document.documentElement.lang = '';
});

describe('survey number formats', () => {
    it('writes a decimal and a percentage in English', () => {
        document.documentElement.lang = 'en';

        expect(formatDecimal(3.8)).toBe('3.8');
        expect(formatDecimal(4)).toBe('4.0');
        expect(formatPercent(67)).toBe('67%');
    });

    it('writes a decimal comma and a spaced percentage in French', () => {
        document.documentElement.lang = 'fr';

        expect(formatDecimal(3.8)).toBe('3,8');
        expect(formatPercent(67)).toMatch(/^67\s%$/u);
    });
});
