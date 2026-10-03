import { describe, expect, it } from 'vitest';
import {
    nextInTurn,
    startPayload,
    takesTurns,
    tellerCandidates,
    turnStates,
} from './turns';
import type { GameRoomSettingsInfo } from './types';

function settings(
    overrides: Partial<GameRoomSettingsInfo> = {},
): GameRoomSettingsInfo {
    return {
        wordThemes: [],
        turnSeconds: null,
        autoHints: false,
        takesTurns: false,
        roundsPerGame: null,
        gifVotes: 1,
        gifAuthorsHidden: false,
        ...overrides,
    };
}

describe('turnStates', () => {
    it('fades the turns already played and rings the current one', () => {
        expect(turnStates(['a', 'b', 'c'], 'b')).toEqual([
            { playerId: 'a', state: 'past' },
            { playerId: 'b', state: 'current' },
            { playerId: 'c', state: 'next' },
        ]);
    });

    it('has every turn still to come when nobody plays', () => {
        expect(turnStates(['a', 'b'], null).map(({ state }) => state)).toEqual([
            'next',
            'next',
        ]);
    });
});

describe('tellerCandidates', () => {
    it('lists the online ready players first, then the offline ready ones', () => {
        expect(tellerCandidates(['c', 'a'], ['a', 'b'])).toEqual(['a', 'c']);
    });

    it('is empty when no set is ready', () => {
        expect(tellerCandidates([], ['a'])).toEqual([]);
    });
});

describe('nextInTurn', () => {
    it('wraps around for hangman', () => {
        expect(nextInTurn(['a', 'b'], 'b', true)).toBe('a');
        expect(nextInTurn(['a', 'b'], 'a', true)).toBe('b');
    });

    it('has nobody after the last Quick question speaker', () => {
        expect(nextInTurn(['a', 'b'], 'b', false)).toBeNull();
    });

    it('has nobody in an empty order', () => {
        expect(nextInTurn([], null, true)).toBeNull();
    });
});

describe('takesTurns', () => {
    it('follows the switch for hangman and always for Quick question', () => {
        expect(takesTurns('hangman', settings({ takesTurns: true }))).toBe(
            true,
        );
        expect(takesTurns('hangman', settings())).toBe(false);
        expect(takesTurns('quick_question', settings())).toBe(true);
        expect(takesTurns('draw', settings({ takesTurns: true }))).toBe(false);
    });
});

describe('startPayload', () => {
    it('names the teller of Two truths', () => {
        expect(startPayload('two_truths', settings(), 'x', ['a', 'b'])).toEqual(
            { leader_player_id: 'x' },
        );
    });

    it('posts the online order of a hangman room in turns', () => {
        expect(
            startPayload('hangman', settings({ takesTurns: true }), null, [
                'a',
                'b',
            ]),
        ).toEqual({ turn_order: ['a', 'b'] });
    });

    it('posts nothing for hangman without turns', () => {
        expect(startPayload('hangman', settings(), null, ['a', 'b'])).toEqual(
            {},
        );
    });

    it('posts the order of a Quick question whatever the switch', () => {
        expect(
            startPayload('quick_question', settings(), null, ['a', 'b']),
        ).toEqual({ turn_order: ['a', 'b'] });
    });
});

describe('startPayload, Draw & Guess', () => {
    it('posts the drawer and the online players as guessers', () => {
        expect(startPayload('draw', settings(), 'x', ['a', 'b'])).toEqual({
            leader_player_id: 'x',
            guesser_player_ids: ['a', 'b'],
        });
    });
});
