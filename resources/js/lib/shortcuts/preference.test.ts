import { afterEach, describe, expect, it } from 'vitest';
import {
    isCharacterKeyCombo,
    setSingleKeyShortcuts,
    singleKeyShortcutsEnabled,
} from '@/lib/shortcuts/preference';

describe('isCharacterKeyCombo', () => {
    it('is true for a letter, a digit, a sign, and a shifted letter', () => {
        for (const combo of ['g', 'F', '1', '?', '/', '+', 'shift+r']) {
            expect(isCharacterKeyCombo(combo)).toBe(true);
        }
    });

    it('is false with mod or alt, and for named keys', () => {
        for (const combo of [
            'mod+k',
            'mod+arrowright',
            'mod+/',
            'alt+n',
            'enter',
            'escape',
            'delete',
            'arrowleft',
            'space',
            'shift+enter',
        ]) {
            expect(isCharacterKeyCombo(combo)).toBe(false);
        }
    });
});

describe('the single-key switch', () => {
    afterEach(() => setSingleKeyShortcuts(true));

    it('is on until told otherwise', () => {
        expect(singleKeyShortcutsEnabled()).toBe(true);

        setSingleKeyShortcuts(false);

        expect(singleKeyShortcutsEnabled()).toBe(false);
    });
});
