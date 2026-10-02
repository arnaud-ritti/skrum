import { describe, expect, it } from 'vitest';
import {
    foldLetter,
    hitLetters,
    keyboardLayoutFor,
    keyboardRows,
} from './hangman';

describe('keyboardRows', () => {
    it.each(['azerty', 'qwertz', 'qwerty'] as const)(
        'holds each of the 26 letters once on %s',
        (layout) => {
            const letters = keyboardRows(layout).flat();

            expect(letters).toHaveLength(26);
            expect([...letters].sort().join('')).toBe(
                'abcdefghijklmnopqrstuvwxyz',
            );
        },
    );

    it('starts each layout with the row its name spells', () => {
        expect(keyboardRows('azerty')[0].join('')).toBe('azertyuiop');
        expect(keyboardRows('qwertz')[0].join('')).toBe('qwertzuiop');
        expect(keyboardRows('qwerty')[0].join('')).toBe('qwertyuiop');
    });
});

describe('keyboardLayoutFor', () => {
    it.each([
        ['fr', 'azerty'],
        ['fr-FR', 'azerty'],
        ['de', 'qwertz'],
        ['de_AT', 'qwertz'],
        ['en', 'qwerty'],
        ['es', 'qwerty'],
        ['', 'qwerty'],
    ])('gives %s the %s layout', (locale, layout) => {
        expect(keyboardLayoutFor(locale)).toBe(layout);
    });
});

describe('hitLetters', () => {
    it('keeps the picked letters the mask shows', () => {
        expect(
            hitLetters(['q', 'u', null, null, null, null], ['q', 'x', 'u']),
        ).toEqual(['q', 'u']);
    });

    it('counts an accented letter of the mask as its plain letter', () => {
        expect(foldLetter('É')).toBe('e');
        expect(hitLetters([null, 'é', ' ', "'"], ['e', 'a'])).toEqual(['e']);
    });
});
