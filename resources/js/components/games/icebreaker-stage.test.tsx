import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';
import { IcebreakerStage } from './icebreaker-stage';

const mocks = vi.hoisted(() => ({
    handleEvent: vi.fn(),
    refetch: vi.fn(),
}));

vi.mock('@/hooks/use-game-room', () => ({
    useGameRoom: (snapshot: unknown) => ({
        state: { snapshot, lastEnded: null },
        dispatch: () => undefined,
        apply: () => undefined,
        run: async () => undefined,
        handleError: () => null,
        handleEvent: mocks.handleEvent,
        refetch: mocks.refetch,
        serverOffset: 0,
        sessionExpired: false,
    }),
}));

vi.mock('./game-stage', async () => {
    const { useRoom } = await import('./room-context');

    return {
        GameStage: () => {
            const { snapshot } = useRoom();

            return (
                <p data-slot="stage-probe">
                    {snapshot.room.timerEndsAt ?? 'no timer'}
                </p>
            );
        },
    };
});

vi.mock('./room-sidebar', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./room-sidebar')>()),
    RoomSidebar: () => <p>the scores</p>,
    RoomPlayersSide: () => <p>the players</p>,
}));

vi.mock('./player-chips', () => ({
    PlayerChips: () => <p>the chips</p>,
}));

vi.mock('@/components/retro/board-cursors', () => ({
    BoardCursors: () => <div className="lc-overlay" />,
}));

function viewport(widestRem: number): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({
                matches:
                    Number(/min-width: (\d+)rem/.exec(query)?.[1]) <= widestRem,
                media: query,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
            }) as unknown as MediaQueryList,
    );
}

const games = [
    { value: 'hangman', label: 'Hangman', available: true },
    { value: 'draw', label: 'Draw & Guess', available: true },
    { value: 'gif', label: 'Sprint in one GIF', available: false },
];

function icebreaker(room: Record<string, unknown> = {}) {
    return {
        room: {
            id: 'room-1',
            game: 'hangman',
            isHost: true,
            isIcebreaker: true,
            timerEndsAt: null,
            ...room,
        },
        me: { playerId: 'player-me' },
        players: [
            { id: 'player-me', presenceId: 'me', name: 'Alice Martin' },
            { id: 'player-bob', presenceId: 'bob', name: 'Bob Stone' },
        ],
        games,
        leaderboard: [],
        history: [],
        round: null,
    };
}

function given(
    room: Record<string, unknown> = {},
    retro: Partial<Snapshot['retro']> = {},
    overrides: Parameters<typeof boardContext>[1] = {},
) {
    const board = retroSnapshot({
        retro: { phase: 'icebreaker', ...retro },
        icebreaker: icebreaker(room) as never,
    });

    return renderInBoard(
        <IcebreakerStage hideMyCursor={false} />,
        boardContext(board, overrides),
    );
}

describe('IcebreakerStage', () => {
    beforeEach(() => {
        mocks.handleEvent.mockReset();
        mocks.refetch.mockReset();
        mocks.refetch.mockResolvedValue(undefined);
        viewport(90);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('waits with a spinner until the board carries the game', () => {
        renderInBoard(
            <IcebreakerStage hideMyCursor={false} />,
            boardContext(retroSnapshot({ retro: { phase: 'icebreaker' } })),
        );

        expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
        expect(
            screen.queryByRole('region', { name: 'Icebreaker game' }),
        ).toBeNull();
    });

    it('lays the game out as a room does, without a landmark of its own, under the live cursors', () => {
        const { container } = given();
        const stage = screen.getByRole('region', { name: 'Icebreaker game' });

        expect(container.querySelector('main')).toBeNull();
        expect(stage.querySelector('[data-slot="game-layout"]')).not.toBeNull();
        expect(
            within(stage).getByRole('complementary', {
                name: 'Players and scores',
            }).textContent,
        ).toBe('the scores');
        expect(
            container
                .querySelector('[data-slot="icebreaker-stage"]')
                ?.querySelector('.lc-overlay'),
        ).not.toBeNull();
    });

    it('gives the facilitator the game cards, the game in play marked', () => {
        given();

        const column = screen.getByRole('complementary', {
            name: 'Choose a game',
        });
        const hangman = within(column).getByRole('radio', { name: 'Hangman' });

        expect(hangman.getAttribute('aria-checked')).toBe('true');
        expect(hangman.getAttribute('aria-disabled')).toBeNull();
        expect(within(hangman).getByText('In play')).toBeTruthy();
        expect(
            within(column)
                .getByRole('radio', { name: 'Sprint in one GIF' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
        expect(screen.queryByRole('combobox', { name: 'Game' })).toBeNull();
    });

    it('shows the cards to a player, who cannot choose', () => {
        given({ isHost: false });

        const column = screen.getByRole('complementary', { name: 'Games' });
        const draw = within(column).getByRole('radio', {
            name: 'Draw & Guess',
        });

        expect(
            within(column).getByText('The facilitator chooses the game.'),
        ).toBeTruthy();
        expect(draw.getAttribute('aria-disabled')).toBe('true');
        expect(draw.getAttribute('data-unavailable')).toBe('false');
        expect(
            within(
                within(column).getByRole('radio', { name: 'Hangman' }),
            ).getByText('In play'),
        ).toBeTruthy();
    });

    it('keeps the sheet of the cards for the facilitator on a narrow screen', () => {
        viewport(40);

        const { unmount } = given({ isHost: false });

        expect(
            screen.queryByRole('button', { name: 'Choose a game' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Games' })).toBeNull();
        expect(screen.queryByRole('radio')).toBeNull();
        expect(screen.getByText('the chips')).toBeTruthy();

        unmount();
        given();

        fireEvent.click(screen.getByRole('button', { name: 'Choose a game' }));

        expect(
            within(screen.getByRole('dialog')).getByRole('radio', {
                name: 'Hangman',
            }),
        ).toBeTruthy();
    });

    it('puts the players on the left for a drawing, and the choice of game behind a button for the facilitator alone', () => {
        const { unmount } = given({ game: 'draw' });

        expect(
            within(
                screen.getByRole('complementary', { name: 'Players' }),
            ).getByRole('button', { name: 'Choose a game' }),
        ).toBeTruthy();

        unmount();
        given({ game: 'draw', isHost: false });

        expect(
            screen.getByRole('complementary', { name: 'Players' }).textContent,
        ).toBe('the players');
        expect(
            screen.queryByRole('button', { name: 'Choose a game' }),
        ).toBeNull();
    });

    it('runs the game on the timer of the board', () => {
        given(
            { timerEndsAt: '2026-01-01T00:00:00Z' },
            { timerEndsAt: '2026-10-02T10:00:00Z' },
        );

        expect(
            document.querySelector('[data-slot="stage-probe"]')?.textContent,
        ).toBe('2026-10-02T10:00:00Z');
    });

    it('hands the game events of the board channel to the room', () => {
        const unsubscribe = vi.fn();
        const subscribeGameEvents = vi.fn(() => unsubscribe);
        const { unmount } = given({}, {}, { subscribeGameEvents });

        expect(subscribeGameEvents).toHaveBeenCalledWith(mocks.handleEvent);

        unmount();

        expect(unsubscribe).toHaveBeenCalled();
    });
});
