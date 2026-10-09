import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound, UndercoverState } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { UndercoverBoard, UndercoverResult } from './undercover-board';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: mocks.request,
}));
const players = ['ada', 'bob', 'ines'].map((id) => ({
    id,
    presenceId: id,
    name: id,
    avatarUrl: '',
    isGuest: false,
}));
function given(
    patch: Partial<UndercoverState> = {},
    me = 'ada',
    isHost = true,
) {
    const state: UndercoverState = {
        stage: 'clues',
        cycle: 1,
        version: 3,
        playerIds: ['ada', 'bob', 'ines'],
        eliminated: [],
        candidates: [],
        myWord: 'coffee',
        myVote: null,
        votedCount: 0,
        ...patch,
    };
    const round = {
        id: 'round',
        game: 'undercover',
        turnPlayerId: 'ada',
        undercover: state,
    } as GameRound;
    const ctx = {
        snapshot: {
            room: { id: 'room', isHost },
            me: { playerId: me },
            players,
            viewerIsObserver: false,
        },
        run: <T,>(promise: Promise<T>) => promise,
        dispatch: vi.fn(),
        refetch: vi.fn().mockResolvedValue(undefined),
    } as unknown as RoomContextValue;
    const view = renderWithProviders(
        <RoomProvider value={ctx}>
            <UndercoverBoard round={round} />
        </RoomProvider>,
    );
    return { ctx, ...view };
}
beforeEach(() => mocks.request.mockReset().mockResolvedValue({ ended: null }));
describe('Undercover', () => {
    it('hides the word until the player explicitly shows it and can hide it again', () => {
        given();
        expect(screen.queryByText('coffee')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Show word' }));
        expect(screen.getByText('coffee')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Hide word' }));
        expect(screen.queryByText('coffee')).toBeNull();
    });
    it('sends the expected version and refetches after advancing', async () => {
        const { ctx } = given();
        await act(async () =>
            fireEvent.click(screen.getByRole('button', { name: 'Next' })),
        );
        expect(mocks.request.mock.calls[0][0].url).toContain(
            '/undercover/advance',
        );
        expect(mocks.request.mock.calls[0][1]).toEqual({ version: 3 });
        expect(ctx.refetch).toHaveBeenCalled();
    });
    it('lets active players vote for others and retract their vote', async () => {
        given({
            stage: 'voting',
            candidates: ['ada', 'bob', 'ines'],
            myVote: 'bob',
            votedCount: 1,
        });
        expect(screen.getAllByRole('button', { name: 'Vote' })).toHaveLength(1);
        await act(async () =>
            fireEvent.click(screen.getByRole('button', { name: 'Your vote' })),
        );
        expect(mocks.request.mock.calls[0][1]).toEqual({
            version: 3,
            choice: 'bob',
        });
        await act(async () =>
            fireEvent.click(
                screen.getByRole('button', { name: 'Cancel my vote' }),
            ),
        );
        expect(mocks.request.mock.calls[1][0].method).toBe('delete');
    });
    it('keeps eliminated players and late arrivals out of voting', () => {
        const { unmount } = given(
            {
                stage: 'voting',
                candidates: ['bob', 'ines'],
                eliminated: [{ playerId: 'ada', role: 'civilian' }],
            },
            'ada',
            false,
        );
        expect(
            screen.getByText('You are eliminated. Watch the rest of the game.'),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Vote' })).toBeNull();
        unmount();
        given(
            { stage: 'voting', myWord: null, candidates: ['ada', 'bob'] },
            'late',
            false,
        );
        expect(
            screen.getByText('You will play in the next round.'),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Show word' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Vote' })).toBeNull();
    });
    it('limits tied ballots to the tied candidates and prevents closing an empty ballot', () => {
        given({ stage: 'voting', candidates: ['bob', 'ines'] });
        expect(
            screen.getByText('Tie: vote again between the tied players.'),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('button', { name: 'Close voting' })
                .hasAttribute('disabled'),
        ).toBe(true);
    });
    it('reveals both words and all camps in the result', () => {
        const ctx = { snapshot: { players } } as unknown as RoomContextValue;
        renderWithProviders(
            <RoomProvider value={ctx}>
                <UndercoverResult
                    result={{
                        words: { civilian: 'coffee', undercover: 'tea' },
                        winner: 'civilian',
                        players: [
                            {
                                playerId: 'ada',
                                role: 'civilian',
                                eliminated: false,
                            },
                            {
                                playerId: 'bob',
                                role: 'undercover',
                                eliminated: true,
                            },
                        ],
                    }}
                />
            </RoomProvider>,
        );
        expect(screen.getByText('The civilians win!')).toBeTruthy();
        expect(screen.getByText('coffee')).toBeTruthy();
        expect(screen.getByText('tea')).toBeTruthy();
        expect(screen.getByText('bob · Undercover · Eliminated')).toBeTruthy();
    });
});
