import type { GameMask } from './types';

export type KeyboardLayout = 'azerty' | 'qwertz' | 'qwerty';

const Rows: Record<KeyboardLayout, string[]> = {
    azerty: ['azertyuiop', 'qsdfghjklm', 'wxcvbn'],
    qwertz: ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'],
    qwerty: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
};

/** The 26 letters in the rows of a physical keyboard. */
export function keyboardRows(layout: KeyboardLayout): string[][] {
    return Rows[layout].map((row) => row.split(''));
}

/** French speakers type on AZERTY, German speakers on QWERTZ, everyone else on QWERTY. */
export function keyboardLayoutFor(locale: string): KeyboardLayout {
    const language = locale.toLowerCase().split(/[-_]/)[0];

    if (language === 'fr') {
        return 'azerty';
    }

    if (language === 'de') {
        return 'qwertz';
    }

    return 'qwerty';
}

/** "é" is found by picking "e": the server compares letters without their accents. */
export function foldLetter(character: string): string {
    return character
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
}

/** The picked letters that the mask shows: the others are misses. */
export function hitLetters(mask: GameMask, picked: string[]): string[] {
    const revealed = new Set(
        mask
            .filter((character): character is string => character !== null)
            .map(foldLetter),
    );

    return picked.filter((letter) => revealed.has(foldLetter(letter)));
}
