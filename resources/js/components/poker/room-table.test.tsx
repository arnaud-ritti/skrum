import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameProvider } from '@/components/poker/game-context';
import { RoomTable } from '@/components/poker/room-table';
import type { RoundActions } from '@/components/poker/use-round-actions';
import {
    pokerPlayer,
    pokerRound,
    pokerSnapshot,
    pokerTask,
    renderInRoom,
} from '@/test/poker-room';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function roundActions(overrides: Partial<RoundActions> = {}): RoundActions {
    return {
        busy: false,
        reveal: vi.fn(async () => {}),
        revote: vi.fn(async () => {}),
        saveEstimate: vi.fn(async () => {}),
        goToNext: vi.fn(async () => {}),
        next: null,
        ...overrides,
    };
}

const task = pokerTask('t1', 'Login page');

const revealed = pokerRound({
    revealedAt: '2026-10-02T09:01:00Z',
    revealReason: 'manual',
    votesCount: 3,
    votes: [
        { playerId: 'ada', value: '5' },
        { playerId: 'bob', value: '3' },
        { playerId: 'cleo', value: '8' },
    ],
    result: {
        average: 5.33,
        median: 5,
        spread: { min: 3, max: 8 },
        agreement: 0.33,
        outliers: { low: ['bob'], high: ['cleo'] },
        distribution: [
            { value: '3', count: 1 },
            { value: '5', count: 1 },
            { value: '8', count: 1 },
        ],
        mode: ['3', '5', '8'],
        consensus: false,
        nearestCard: '5',
    },
});

describe('RoomTable without a round', () => {
    it('calls for the first task, with the button for who may add one', () => {
        const { unmount } = renderInRoom(
            <RoomTable task={null} actions={roundActions()} />,
            pokerSnapshot({ tasks: [], current: null }),
        );

        expect(
            screen.getByRole('heading', { name: 'Add the first task' }),
        ).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add task' })).toBeTruthy();
        unmount();

        renderInRoom(
            <RoomTable task={null} actions={roundActions()} />,
            pokerSnapshot({
                tasks: [],
                current: null,
                me: { canEditTasks: false, isFacilitator: false },
            }),
        );

        expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull();
    });

    it('tells the facilitator to pick a task and the others to wait', () => {
        const { unmount } = renderInRoom(
            <RoomTable task={null} actions={roundActions()} />,
            pokerSnapshot({ current: null }),
        );

        expect(
            screen.getByRole('heading', {
                name: 'Pick a task to start voting',
            }),
        ).toBeTruthy();
        unmount();

        renderInRoom(
            <RoomTable task={null} actions={roundActions()} />,
            pokerSnapshot({ current: null, me: { isFacilitator: false } }),
        );

        expect(
            screen.getByRole('heading', {
                name: 'Waiting for the facilitator to pick a task',
            }),
        ).toBeTruthy();
    });
});

describe('RoomTable with a round', () => {
    it('seats the players without the task in the Players section, and reveals for the facilitator', () => {
        const actions = roundActions();
        renderInRoom(
            <RoomTable task={task} actions={actions} />,
            pokerSnapshot({
                current: {
                    taskId: 't1',
                    round: pokerRound({
                        votesCount: 1,
                        votes: [{ playerId: 'bob', value: null }],
                    }),
                },
            }),
        );
        const players = screen.getByRole('region', { name: 'Players' });

        expect(
            within(players).getByRole('img', { name: 'Bob: Voted' }),
        ).toBeTruthy();
        expect(
            within(players).getByRole('img', { name: 'Ada: Not voted yet' }),
        ).toBeTruthy();
        expect(within(players).queryByText(/Login page/)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Reveal cards' }));

        expect(actions.reveal).toHaveBeenCalledTimes(1);
    });

    it('gives the facilitator a role menu on every seat but their own', () => {
        const { unmount } = renderInRoom(
            <RoomTable task={task} actions={roundActions()} />,
            pokerSnapshot({
                players: [
                    pokerPlayer('ada', 'Ada'),
                    pokerPlayer('bob', 'Bob'),
                    pokerPlayer('casey', 'Casey', { isSpectator: true }),
                ],
            }),
        );

        expect(
            screen.getAllByRole('button', { name: 'Player options' }),
        ).toHaveLength(2);
        expect(
            within(screen.getByRole('region', { name: 'Watching' })).getByText(
                'Casey',
            ),
        ).toBeTruthy();
        unmount();

        renderInRoom(
            <RoomTable task={task} actions={roundActions()} />,
            pokerSnapshot({ me: { isFacilitator: false } }),
        );

        expect(
            screen.queryByRole('button', { name: 'Player options' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Reveal cards' }),
        ).toBeNull();
    });

    it('shows the figures of the server once revealed, in the section the browser suite reads, without the actions', () => {
        const { container } = renderInRoom(
            <RoomTable task={task} actions={roundActions()} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );
        const result = container.querySelector(
            '[aria-labelledby="poker-result"]',
        ) as HTMLElement;

        expect(within(result).getByText('Median')).toBeTruthy();
        expect(within(result).getByText('Spread 3 → 8')).toBeTruthy();
        expect(within(result).getByText('33 % on 3, 5, 8')).toBeTruthy();
        expect(within(result).getByText('Nearest card: 5')).toBeTruthy();
        expect(
            within(result).getByText(
                'Bob (3) and Cleo (8) open the discussion.',
            ),
        ).toBeTruthy();
        expect(
            within(result).queryByRole('button', { name: 'Re-vote' }),
        ).toBeNull();
        expect(screen.getByRole('img', { name: 'Bob: 3' })).toBeTruthy();
    });

    it('names nobody on an anonymous round', () => {
        renderInRoom(
            <RoomTable task={task} actions={roundActions()} />,
            pokerSnapshot({
                current: {
                    taskId: 't1',
                    round: { ...revealed, anonymous: true },
                },
            }),
        );

        expect(screen.queryByText(/Bob \(3\)/)).toBeNull();
        expect(
            screen.getByRole('region', { name: 'Anonymous votes' }),
        ).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Bob: Voted' })).toBeTruthy();
    });

    it('offers no reveal on an ended game', () => {
        renderInRoom(
            <RoomTable task={task} actions={roundActions()} />,
            pokerSnapshot({ game: { endedAt: '2026-10-02T10:00:00Z' } }),
        );

        expect(
            screen.queryByRole('button', { name: 'Reveal cards' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Player options' }),
        ).toBeNull();
    });
});

describe('RoomTable, a spectator who voted before a named reveal', () => {
    it('is offered "Make player", as the player record says', async () => {
        mocks.request.mockResolvedValue({});
        renderInRoom(
            <RoomTable task={task} actions={roundActions()} />,
            pokerSnapshot({
                players: [
                    pokerPlayer('ada', 'Ada'),
                    pokerPlayer('bob', 'Bob', { isSpectator: true }),
                    pokerPlayer('cleo', 'Cleo'),
                ],
                current: { taskId: 't1', round: revealed },
            }),
        );

        const bob = screen
            .getByRole('img', { name: /^Bob/ })
            .closest('[data-slot="poker-seat"]') as HTMLElement;

        fireEvent.keyDown(
            within(bob).getByRole('button', { name: 'Player options' }),
            { key: 'Enter' },
        );

        await act(async () => {
            fireEvent.click(
                await screen.findByRole('menuitem', { name: 'Make player' }),
            );
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({ spectator: false });
    });
});

describe('RoomTable, when the cards are revealed', () => {
    it('brings the result into view', () => {
        const scrollIntoView = vi.fn();

        Element.prototype.scrollIntoView = scrollIntoView;

        const { ctx, rerender, container } = renderInRoom(
            <RoomTable task={task} actions={roundActions()} />,
        );

        expect(scrollIntoView).not.toHaveBeenCalled();

        act(() => {
            rerender(
                <GameProvider
                    value={{
                        ...ctx,
                        snapshot: pokerSnapshot({
                            current: { taskId: 't1', round: revealed },
                        }),
                    }}
                >
                    <RoomTable task={task} actions={roundActions()} />
                </GameProvider>,
            );
        });

        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView.mock.instances[0]).toBe(
            container.querySelector('[aria-labelledby="poker-result"]'),
        );
    });
});
