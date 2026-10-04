import { describe, expect, it } from 'vitest';
import { roundTitle } from './round-title';

const t = (key: string, replacements: Record<string, string | number> = {}) =>
    Object.entries(replacements).reduce(
        (text, [name, value]) => text.replace(`:${name}`, String(value)),
        key,
    );

describe('roundTitle', () => {
    it('names a round by its word, else by its question', () => {
        expect(
            roundTitle({ game: 'hangman', word: 'quartz', question: null }, t),
        ).toBe('quartz');
        expect(
            roundTitle(
                { game: 'quick_question', word: null, question: 'Why?' },
                t,
            ),
        ).toBe('Why?');
    });

    it('names a Mood weather round by its game and a Two truths round by its statements', () => {
        expect(
            roundTitle({ game: 'mood', word: null, question: null }, t),
        ).toBe('Mood weather');
        expect(
            roundTitle({ game: 'two_truths', word: null, question: null }, t),
        ).toBe('3 statements');
    });

    it('falls back to a dash', () => {
        expect(roundTitle({ game: 'gif', word: null, question: null }, t)).toBe(
            '—',
        );
    });
});
