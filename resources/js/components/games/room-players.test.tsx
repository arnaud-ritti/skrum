import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomPlayers } from './room-players';

function player(id: string, extra: Record<string, unknown> = {}) {
    return {
        id,
        presenceId: `presence-${id}`,
        name: id,
        avatarUrl: `/avatars/${id}.svg`,
        isGuest: false,
        ...extra,
    };
}

function context(overrides: Record<string, unknown> = {}): RoomContextValue {
    return {
        snapshot: {
            room: {
                id: 'r1',
                game: 'hangman',
                hostPlayerId: 'ada',
                canManage: false,
                isIcebreaker: false,
            },
            me: { playerId: 'bob' },
            players: [player('ada'), player('bob'), player('cy')],
            leaderboard: [
                { playerId: 'cy', points: 60, wins: 1, roundsPlayed: 2 },
                { playerId: 'gone', points: 40, wins: 0, roundsPlayed: 2 },
                { playerId: 'bob', points: 10, wins: 0, roundsPlayed: 2 },
            ],
            history: [],
            round: null,
            ...overrides,
        },
        lastEnded: null,
        online: [{ id: 'presence-ada' }, { id: 'presence-bob' }],
    } as unknown as RoomContextValue;
}

function rows(): string[] {
    return [...document.querySelectorAll('[data-slot="player-row"]')].map(
        (row) =>
            [
                row.querySelector('[data-slot="player-rank"]')?.textContent,
                row.querySelector('[data-slot="player-name"]')?.textContent,
                row
                    .querySelector('[data-slot="player-points"]')
                    ?.getAttribute('aria-label'),
            ].join(' | '),
    );
}

describe('RoomPlayers', () => {
    it('is one ranked list of every player with their points, without tabs', () => {
        renderWithProviders(
            <RoomProvider value={context()}>
                <RoomPlayers title="Scores" />
            </RoomProvider>,
        );

        expect(screen.queryByRole('tab')).toBeNull();
        expect(screen.getByRole('heading', { name: 'Scores' }).id).toBe(
            'game-players',
        );
        expect(screen.getByText('3 players')).toBeTruthy();
        expect(rows()).toEqual([
            '1 | cy | 60 points',
            '2 | Former member | 40 points',
            '3 | bob(you) | 10 points',
            '– | adaHost | 0 points',
        ]);
        expect(
            document
                .querySelector('[data-slot="player-row"]')
                ?.getAttribute('data-offline'),
        ).toBe('true');
        expect(screen.queryByText('No points yet.')).toBeNull();
    });

    it('says so while nobody has a point, and offers the reset to who manages the room', () => {
        const ctx = context({
            leaderboard: [],
            room: {
                id: 'r1',
                game: 'hangman',
                hostPlayerId: 'ada',
                canManage: true,
                isIcebreaker: false,
            },
        });

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomPlayers title="Scores" highlightPlayerId="bob" />
            </RoomProvider>,
        );

        expect(screen.getByText('No points yet.')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Reset scores' }),
        ).toBeTruthy();
        expect(rows()[0]).toBe('– | adaHost | 0 points');
        expect(
            within(
                document.querySelector(
                    '[data-slot="player-row"][data-me]',
                ) as HTMLElement,
            ).getByLabelText('Winner'),
        ).toBeTruthy();
    });

    it('says who draws and who guesses in a Draw & Guess round, the drawer marked', () => {
        const ctx = context({
            room: { id: 'r1', game: 'draw', hostPlayerId: 'ada' },
            round: { id: 'round', game: 'draw', leaderPlayerId: 'cy' },
        });

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomPlayers title="Players" />
            </RoomProvider>,
        );

        const drawer = document.querySelector(
            '[data-slot="player-row"][data-turn]',
        ) as HTMLElement;

        expect(drawer.textContent).toContain('cy');
        expect(drawer.textContent).toContain('drawing');
        expect(screen.getAllByText('guessing…')).toHaveLength(2);
    });

    it('marks each finder of a Draw & Guess round with the time they found', () => {
        const ctx = context({
            room: { id: 'r1', game: 'draw', hostPlayerId: 'ada' },
            round: {
                id: 'round',
                game: 'draw',
                leaderPlayerId: 'cy',
                guessersTotal: 2,
                finders: [{ playerId: 'ada', seconds: 18, points: 10 }],
            },
        });

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomPlayers title="Players" />
            </RoomProvider>,
        );

        expect(screen.getByText('found · 0:18')).toBeTruthy();
        expect(screen.getAllByText('guessing…')).toHaveLength(1);
    });

    it('lists the participants of Sprint in one GIF without rank or points', () => {
        const ctx = context({
            room: { id: 'r1', game: 'gif', hostPlayerId: 'ada' },
            round: {
                id: 'round',
                game: 'gif',
                revealedAt: null,
                answers: [{ playerId: 'ada', answered: true }],
                myAnswer: null,
            },
        });

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomPlayers title="Participants" points={false} />
            </RoomProvider>,
        );

        expect(rows()).toEqual([
            ' | adaHostGIF picked | ',
            ' | bob(you)picking… | ',
            ' | cypicking… | ',
        ]);
        expect(screen.getByText('1 / 2')).toBeTruthy();
        expect(screen.queryByText('No points yet.')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Reset scores' }),
        ).toBeNull();
    });
});
