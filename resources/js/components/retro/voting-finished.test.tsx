import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardProvider } from '@/components/retro/board-context';
import type { BoardContextValue } from '@/components/retro/board-context';
import {
    BoardVotingBar,
    FinishButton,
    FinishedCount,
} from '@/components/retro/voting-finished';
import { boardReducer } from '@/lib/retro/board-reducer';
import type { BoardAction } from '@/lib/retro/board-reducer';
import type { Snapshot } from '@/lib/retro/types';
import { boardContext, retroSnapshot } from '@/test/retro-board';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

const people = [
    { id: 'me', name: 'Alice Martin', avatarUrl: '/a.svg', isGuest: false },
    { id: 'bob', name: 'Bob Stone', avatarUrl: '/b.svg', isGuest: false },
    { id: 'guest', name: 'Gus', avatarUrl: '/g.svg', isGuest: true },
];

function voting(
    finishedIds: string[] = [],
    maxVotesPerCard: number | null = null,
) {
    return retroSnapshot({
        participants: people,
        retro: { phase: 'voting', votesPerParticipant: 5, maxVotesPerCard },
        voting: { finishedIds },
    });
}

let current: { board: Snapshot; apply: (action: BoardAction) => void };

/** A board whose actions go through the real reducer, as the page's do. */
function Live({
    initial,
    children,
    overrides = {},
}: {
    initial: Snapshot;
    children: React.ReactNode;
    overrides?: Partial<BoardContextValue>;
}) {
    const [board, setBoard] = useState(initial);
    const apply = (action: BoardAction) =>
        setBoard((state) => boardReducer(state, action));

    current = { board, apply };

    return (
        <BoardProvider
            value={boardContext(board, {
                online: people,
                apply,
                dispatch: apply,
                ...overrides,
            })}
        >
            {children}
        </BoardProvider>
    );
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

const takenBack =
    "You changed your votes: you're no longer marked as finished.";

beforeEach(() => {
    mocks.request.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('FinishedCount', () => {
    it('counts the people online who have finished, a guest included', () => {
        renderWithProviders(
            <Live initial={voting(['me', 'guest', 'gone'])}>
                <FinishedCount />
            </Live>,
        );

        const count = screen.getByLabelText('2 of 3 have finished');

        expect(count.textContent).toContain('2/3 have finished');
    });

    it('follows a voting.finished event', () => {
        renderWithProviders(
            <Live initial={voting()}>
                <FinishedCount />
            </Live>,
        );

        act(() =>
            current.apply({
                type: 'voting.finished',
                finishedIds: ['me', 'bob', 'guest'],
            }),
        );

        expect(screen.getByLabelText('3 of 3 have finished')).toBeTruthy();
    });
});

describe('FinishButton', () => {
    it('says the viewer has finished, disabled while the request runs', async () => {
        const answer = deferred<{ finishedIds: string[] }>();
        mocks.request.mockReturnValue(answer.promise);
        renderWithProviders(
            <Live initial={voting()}>
                <FinishButton />
            </Live>,
        );

        const finish = screen.getByRole('button', {
            name: 'I have finished voting',
        });

        fireEvent.click(finish);

        expect(mocks.request.mock.calls[0][0]).toMatchObject({
            method: 'put',
        });
        expect(mocks.request.mock.calls[0][0].url).toContain(
            '/voting-completion',
        );
        expect((finish as HTMLButtonElement).disabled).toBe(true);

        await act(async () => answer.resolve({ finishedIds: ['me'] }));

        expect(current.board.voting.finishedIds).toEqual(['me']);

        const change = screen.getByRole('button', { name: 'Change my votes' });

        expect((change as HTMLButtonElement).disabled).toBe(false);
        expect(screen.queryByText(takenBack)).toBeNull();
    });

    it('takes it back with "Change my votes", without the status line', async () => {
        mocks.request.mockResolvedValue({ finishedIds: [] });
        renderWithProviders(
            <Live initial={voting(['me'])}>
                <FinishButton />
            </Live>,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Change my votes' }),
        );

        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: 'I have finished voting' }),
            ).toBeTruthy(),
        );
        expect(mocks.request.mock.calls[0][0]).toMatchObject({
            method: 'delete',
        });
        expect(current.board.voting.finishedIds).toEqual([]);
        expect(screen.queryByText(takenBack)).toBeNull();
    });

    it('says so for 5 s when a vote takes "finished" back', () => {
        vi.useFakeTimers();
        renderWithProviders(
            <Live initial={voting(['me', 'bob'])}>
                <FinishButton />
            </Live>,
        );

        act(() =>
            current.apply({ type: 'voting.finished', finishedIds: ['bob'] }),
        );

        expect(screen.getByText(takenBack).getAttribute('aria-live')).toBe(
            'polite',
        );
        expect(
            screen.getByRole('button', { name: 'I have finished voting' }),
        ).toBeTruthy();

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(screen.queryByText(takenBack)).toBeNull();
    });

    it('applies nothing and lets the viewer try again when the request fails', async () => {
        const failed = vi.fn();
        mocks.request.mockRejectedValue(new Error('Network error'));
        renderWithProviders(
            <Live
                initial={voting()}
                overrides={{
                    run: async (mutation) => {
                        try {
                            return await mutation;
                        } catch (error) {
                            failed(error);

                            return undefined;
                        }
                    },
                }}
            >
                <FinishButton />
            </Live>,
        );

        const finish = screen.getByRole('button', {
            name: 'I have finished voting',
        });

        fireEvent.click(finish);

        await waitFor(() =>
            expect((finish as HTMLButtonElement).disabled).toBe(false),
        );
        expect(failed).toHaveBeenCalledOnce();
        expect(current.board.voting.finishedIds).toEqual([]);
        expect(screen.queryByText(takenBack)).toBeNull();
    });
});

describe('BoardVotingBar', () => {
    it('fills the cap, the finished count and the button in Voting', () => {
        const { container } = renderWithProviders(
            <Live initial={voting(['bob'], 2)}>
                <BoardVotingBar />
            </Live>,
        );

        expect(
            container.querySelector('[data-slot="vote-budget-detail"]')
                ?.textContent,
        ).toBe('of 5 · max 2 per card');
        expect(screen.getByText('0 of 15 votes cast')).toBeTruthy();
        expect(screen.getByLabelText('1 of 3 have finished')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'I have finished voting' }),
        ).toBeTruthy();
    });

    it('says no cap without one, and keeps the cap in the stuck budget of a phone', () => {
        const { container, unmount } = renderWithProviders(
            <Live initial={voting()}>
                <BoardVotingBar />
            </Live>,
        );

        expect(
            container.querySelector('[data-slot="vote-budget-detail"]')
                ?.textContent,
        ).toBe('of 5');
        unmount();

        const phone = renderWithProviders(
            <Live initial={voting([], 3)}>
                <BoardVotingBar part="budget" />
            </Live>,
        );

        expect(
            phone.container.querySelector('[data-slot="vote-budget-detail"]')
                ?.textContent,
        ).toBe('of 5 · max 3 per card');
        expect(screen.queryByRole('button')).toBeNull();
    });
});
