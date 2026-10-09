import type { GameKind, WordTheme } from './types';

export type GameSettingKey =
    | 'wordTheme'
    | 'categories'
    | 'turnSeconds'
    | 'autoHints'
    | 'takesTurns'
    | 'roundsPerGame'
    | 'gifVotes'
    | 'gifAuthorsHidden'
    | 'guestsAllowed';

/** Spec §6.2: the rows of each game's settings card, in the mockups' order. */
export const SettingsByGame: Record<GameKind, GameSettingKey[]> = {
    hangman: [
        'wordTheme',
        'turnSeconds',
        'takesTurns',
        'roundsPerGame',
        'guestsAllowed',
    ],
    draw: ['wordTheme', 'turnSeconds', 'autoHints', 'roundsPerGame'],
    decoded: ['categories', 'turnSeconds', 'autoHints', 'roundsPerGame'],
    gif: ['gifVotes', 'gifAuthorsHidden', 'roundsPerGame'],
    two_truths: ['turnSeconds', 'roundsPerGame'],
    undercover: ['roundsPerGame'],
    mood: [],
    guess_who: ['roundsPerGame'],
    quick_question: ['turnSeconds', 'roundsPerGame'],
};

export const WordThemes: WordTheme[] = ['work', 'objects', 'food', 'nature'];

/** The games whose words come from the themes. */
export const WordGames: GameKind[] = ['hangman', 'draw', 'decoded'];

/** The labels of `GameWordTheme::label()`. */
export function wordThemeLabel(
    theme: WordTheme,
    t: (key: string) => string,
): string {
    switch (theme) {
        case 'work':
            return t('Team & tech');
        case 'objects':
            return t('Everyday objects');
        case 'food':
            return t('Food');
        case 'nature':
            return t('Nature & animals');
    }
}

export const TurnSecondsOptions = [15, 30, 45, 60, 80, 90, 120, 180] as const;

export const RoundsOptions = [3, 5, 6, 8, 10] as const;

export const GifVotesOptions = [1, 2, 3] as const;

type SettingValue = WordTheme | WordTheme[] | number | boolean | null;

/** The body of PATCH /games/{room} for one change of the card ("guests allowed" is the room's access). */
export function settingsPatch(
    key: Exclude<GameSettingKey, 'guestsAllowed'>,
    value: SettingValue,
): Record<string, SettingValue> {
    switch (key) {
        case 'wordTheme':
            return { word_themes: value === null ? [] : [value as WordTheme] };
        case 'categories':
            return { word_themes: value };
        case 'turnSeconds':
            return { turn_seconds: value };
        case 'autoHints':
            return { auto_hints: value };
        case 'takesTurns':
            return { takes_turns: value };
        case 'roundsPerGame':
            return { rounds_per_game: value };
        case 'gifVotes':
            return { gif_votes: value };
        case 'gifAuthorsHidden':
            return { gif_authors_hidden: value };
    }
}
