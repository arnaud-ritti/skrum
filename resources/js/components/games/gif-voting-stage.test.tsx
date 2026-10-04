import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameGifRevealed, GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GifVotingStage } from './gif-voting-stage';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function answer(
    id: string,
    playerId: string | null,
    caption: string | null = null,
): GameGifRevealed {
    return {
        id,
        playerId,
        caption,
        gif: { id, previewUrl: `/gifs/${id}/preview`, url: `/gifs/${id}/full` },
    };
}

function round(overrides: Partial<GameRound> = {}): GameRound {
    return {
        id: 'round',
        game: 'gif',
        revealedAt: '2026-10-03T10:00:00+00:00',
        answers: [
            answer('mine', 'ada'),
            answer('b', 'bob', 'CI on Friday'),
            answer('c', 'cy'),
            answer('d', 'dee'),
        ],
        myAnswer: { id: 'mine', gif: answer('mine', null).gif, caption: null },
        voters: [],
        myVote: null,
        myVotes: [],
        votesAllowed: 2,
        authorsHidden: false,
        ...overrides,
    } as GameRound;
}

function renderStage(current: GameRound) {
    const dispatch = vi.fn();
    const ctx = {
        snapshot: {
            room: { id: 'room', isHost: false },
            me: { playerId: 'ada' },
            players: [
                { id: 'ada', name: 'Ada', avatarUrl: null, isGuest: false },
                { id: 'bob', name: 'Bob', avatarUrl: null, isGuest: false },
                { id: 'cy', name: 'Cy', avatarUrl: null, isGuest: true },
                { id: 'dee', name: 'Dee', avatarUrl: null, isGuest: false },
            ],
        },
        online: [],
        dispatch,
        run: <T,>(mutation: Promise<T>) =>
            mutation.catch(() => undefined) as Promise<T | undefined>,
        refetch: vi.fn(),
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <GifVotingStage round={current} />
        </RoomProvider>,
    );

    return { dispatch };
}

function tileOf(name: string): HTMLElement {
    const tile = screen
        .getAllByRole('figure')
        .find((figure) => figure.textContent?.includes(name));

    if (!tile) {
        throw new Error(`No tile for ${name}`);
    }

    return tile;
}

describe('GifVotingStage', () => {
    beforeEach(() => {
        mocks.request.mockReset();
    });

    it("gives a heart to each GIF but the player's own, with the caption under it", () => {
        renderStage(round());

        expect(
            within(tileOf('Your GIF')).queryByRole('button', {
                name: /^Vote for GIF \d$/,
            }),
        ).toBeNull();
        expect(
            screen
                .getAllByRole('button', { name: /^Vote for GIF \d$/ })
                .map((heart) => heart.getAttribute('aria-label')),
        ).toEqual(['Vote for GIF 2', 'Vote for GIF 3', 'Vote for GIF 4']);
        expect(within(tileOf('by Bob')).getByText('CI on Friday')).toBeTruthy();
        expect(screen.getByText('Your votes')).toBeTruthy();
        expect(screen.getByText('0 / 2 used')).toBeTruthy();
        expect(screen.queryByText('Favourite')).toBeNull();
    });

    it('adds a vote at once and sends it, then withdraws that vote alone', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderStage(round({ myVotes: ['c'] }));

        expect(screen.getByText('1 / 2 used')).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                within(tileOf('by Bob')).getByRole('button', {
                    name: /^Vote for GIF \d$/,
                }),
            );
        });

        expect(dispatch).toHaveBeenNthCalledWith(1, {
            type: 'round.patched',
            roundId: 'round',
            patch: { myVotes: ['c', 'b'], myVote: 'c' },
        });
        expect(mocks.request.mock.calls[0][1]).toEqual({ answer_id: 'b' });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'vote.changed',
            roundId: 'round',
            playerId: 'ada',
            voted: true,
        });

        const pressed = within(tileOf('by Cy')).getByRole('button', {
            name: /^Vote for GIF \d$/,
        });

        expect(pressed.getAttribute('aria-pressed')).toBe('true');

        await act(async () => {
            fireEvent.click(pressed);
        });

        expect(mocks.request.mock.calls[1][0].method).toBe('delete');
        expect(mocks.request.mock.calls[1][1]).toEqual({ answer_id: 'c' });
    });

    it('rolls the vote back when the server refuses it', async () => {
        mocks.request.mockRejectedValue(new Error('409'));
        const { dispatch } = renderStage(round({ myVotes: ['c'] }));

        await act(async () => {
            fireEvent.click(
                within(tileOf('by Bob')).getByRole('button', {
                    name: /^Vote for GIF \d$/,
                }),
            );
        });

        expect(dispatch).toHaveBeenLastCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { myVotes: ['c'], myVote: 'c' },
        });
    });

    it('blocks the other hearts once the budget is used, but not taking a vote back', () => {
        renderStage(round({ myVotes: ['b', 'c'] }));

        expect(screen.getByText('2 / 2 used')).toBeTruthy();
        expect(
            (
                within(tileOf('by Dee')).getByRole('button', {
                    name: /^Vote for GIF \d$/,
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            within(tileOf('by Dee')).getByRole('group', {
                name: 'You have used all your votes.',
            }),
        ).toBeTruthy();
        expect(
            (
                within(tileOf('by Bob')).getByRole('button', {
                    name: /^Vote for GIF \d$/,
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
    });

    it('keeps "Favourite" and no budget in a one-vote round, replacing the vote', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderStage(
            round({ votesAllowed: 1, myVote: 'c', myVotes: ['c'] }),
        );

        expect(screen.queryByText('Your votes')).toBeNull();
        expect(
            screen.queryByRole('button', { name: /^Vote for GIF \d$/ }),
        ).toBeNull();

        await act(async () => {
            fireEvent.click(
                within(tileOf('by Bob')).getByRole('button', {
                    name: /^Favourite: GIF \d$/,
                }),
            );
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({ answer_id: 'b' });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { myVotes: ['b'], myVote: 'b' },
        });
    });

    it('says the authors come at the close when the round hides them', () => {
        renderStage(
            round({
                authorsHidden: true,
                answers: [answer('mine', null), answer('b', null)],
            }),
        );

        expect(screen.getByText('Hidden until the votes close')).toBeTruthy();
        expect(screen.queryByText('Anonymous GIF')).toBeNull();
    });

    it('says a GIF is anonymous on an anonymous retro', () => {
        renderStage(
            round({ answers: [answer('mine', null), answer('b', null)] }),
        );

        expect(screen.getByText('Anonymous GIF')).toBeTruthy();
        expect(screen.queryByText('Hidden until the votes close')).toBeNull();
    });
});
