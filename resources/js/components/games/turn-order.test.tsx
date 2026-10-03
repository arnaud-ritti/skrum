import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
    GameKind,
    GameRoomSettingsInfo,
    GameRound,
} from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { TurnOrder } from './turn-order';

const players = ['ada', 'bob', 'cy', 'dee'].map((id) => ({
    id,
    presenceId: `presence-${id}`,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    avatarUrl: '',
    isGuest: false,
}));

type Setup = {
    game: GameKind;
    round?: Partial<GameRound> | null;
    settings?: Partial<GameRoomSettingsInfo>;
    online?: string[];
    ready?: string[];
};

function renderOrder({
    game,
    round = null,
    settings = {},
    online = ['ada', 'bob', 'cy', 'dee'],
    ready = [],
}: Setup) {
    const ctx = {
        snapshot: {
            room: {
                id: 'room',
                game,
                settings: {
                    wordThemes: [],
                    turnSeconds: null,
                    autoHints: false,
                    takesTurns: true,
                    roundsPerGame: null,
                    gifVotes: 1,
                    gifAuthorsHidden: false,
                    ...settings,
                },
            },
            me: { playerId: 'ada' },
            players,
            history: [],
            round: round === null ? null : { game, turnOrder: [], ...round },
            truthSets: game === 'two_truths' ? { ready, mine: null } : null,
        },
        lastEnded: null,
        online: online.map((id) => ({ id: `presence-${id}` })),
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <TurnOrder />
        </RoomProvider>,
    );
}

function states(): (string | null)[] {
    return [
        ...document.querySelectorAll('[data-slot="turn-order"] [data-state]'),
    ].map((item) => item.getAttribute('data-state'));
}

describe('TurnOrder', () => {
    it('follows the order of a hangman round in turns, round and round', () => {
        renderOrder({
            game: 'hangman',
            round: {
                turnOrder: ['bob', 'cy', 'ada'],
                turnPlayerId: 'ada',
                turnSeconds: 30,
            },
        });

        expect(screen.getByText('Speaking order')).toBeTruthy();
        expect(states()).toEqual(['past', 'past', 'current']);
        expect(
            document
                .querySelector('[data-state="current"]')
                ?.getAttribute('aria-current'),
        ).toBe('step');
        expect(screen.getByText('Next: Bob · 30 s per turn')).toBeTruthy();
    });

    it('names nobody after the last speaker of a Quick question', () => {
        renderOrder({
            game: 'quick_question',
            round: { turnOrder: ['bob', 'cy'], turnPlayerId: 'cy' },
        });

        expect(states()).toEqual(['past', 'current']);
        expect(screen.queryByText(/Next:/)).toBeNull();
    });

    it('turns the online players of Draw & Guess round, the drawer ringed', () => {
        renderOrder({
            game: 'draw',
            round: { leaderPlayerId: 'bob' },
            settings: { turnSeconds: 80 },
            online: ['ada', 'bob', 'dee'],
        });

        expect(screen.getByText('Drawing order')).toBeTruthy();
        expect(states()).toEqual(['past', 'current', 'next']);
        expect(screen.getByText('Next: Dee · 80 s per turn')).toBeTruthy();
    });

    it('calls the order of Two truths the order of tellers', () => {
        renderOrder({ game: 'two_truths', ready: ['bob'] });

        expect(screen.getByText('Order of tellers')).toBeTruthy();
    });

    it('lists only the tellers with statements ready, after the teller in play', () => {
        renderOrder({
            game: 'two_truths',
            round: { leaderPlayerId: 'bob' },
            ready: ['ada', 'dee'],
        });

        expect(states()).toEqual(['current', 'next', 'next']);
        expect(screen.getByText('Next: Dee')).toBeTruthy();
    });

    it('is hidden in Two truths while no one has statements ready', () => {
        renderOrder({ game: 'two_truths', ready: [] });

        expect(document.querySelector('[data-slot="turn-order"]')).toBeNull();
    });

    it('is hidden for hangman without turns and for the games without an order', () => {
        renderOrder({ game: 'hangman', round: { turnOrder: [] } });
        renderOrder({ game: 'gif' });

        expect(document.querySelector('[data-slot="turn-order"]')).toBeNull();
    });
});
