import { describe, expect, it } from 'vitest';
import { SettingsByGame, settingsPatch } from './settings';

describe('SettingsByGame', () => {
    it('lists the rows of each game in the order of the mockups', () => {
        expect(SettingsByGame).toEqual({
            hangman: [
                'wordTheme',
                'turnSeconds',
                'takesTurns',
                'roundsPerGame',
                'guestsAllowed',
            ],
            draw: ['wordTheme', 'turnSeconds', 'autoHints', 'roundsPerGame'],
            decoded: [
                'categories',
                'turnSeconds',
                'autoHints',
                'roundsPerGame',
            ],
            gif: ['gifVotes', 'gifAuthorsHidden', 'roundsPerGame'],
            two_truths: ['turnSeconds', 'roundsPerGame'],
            mood: [],
            guess_who: ['roundsPerGame'],
            quick_question: ['turnSeconds', 'roundsPerGame'],
        });
    });
});

describe('settingsPatch', () => {
    it('sends every theme when the word theme is cleared', () => {
        expect(settingsPatch('wordTheme', null)).toEqual({ word_themes: [] });
    });

    it('sends one theme when one is chosen', () => {
        expect(settingsPatch('wordTheme', 'food')).toEqual({
            word_themes: ['food'],
        });
    });

    it('sends the categories as they are', () => {
        expect(settingsPatch('categories', ['work', 'food'])).toEqual({
            word_themes: ['work', 'food'],
        });
    });

    it('sends a turn without limit as null', () => {
        expect(settingsPatch('turnSeconds', null)).toEqual({
            turn_seconds: null,
        });
    });

    it('names each other setting in snake case', () => {
        expect(settingsPatch('autoHints', true)).toEqual({ auto_hints: true });
        expect(settingsPatch('takesTurns', false)).toEqual({
            takes_turns: false,
        });
        expect(settingsPatch('roundsPerGame', 5)).toEqual({
            rounds_per_game: 5,
        });
        expect(settingsPatch('gifVotes', 2)).toEqual({ gif_votes: 2 });
        expect(settingsPatch('gifAuthorsHidden', true)).toEqual({
            gif_authors_hidden: true,
        });
    });
});
