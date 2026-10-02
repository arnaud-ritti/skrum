import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoomResult } from '@/components/poker/room-result';
import type { RoundActions } from '@/components/poker/use-round-actions';
import { pokerRound, pokerSnapshot, renderInRoom } from '@/test/poker-room';

function roundActions(overrides: Partial<RoundActions> = {}): RoundActions {
    return {
        busy: false,
        reveal: vi.fn(async () => {}),
        revote: vi.fn(async () => {}),
        saveEstimate: vi.fn(async () => {}),
        goToNext: vi.fn(async () => {}),
        validate: vi.fn(async () => {}),
        estimate: '5',
        estimateCards: ['1', '2', '3', '5', '8'],
        chooseEstimate: vi.fn(),
        next: null,
        ...overrides,
    };
}

const revealed = pokerRound({
    revealedAt: '2026-10-02T09:01:00Z',
    revealReason: 'manual',
    votesCount: 2,
    votes: [
        { playerId: 'ada', value: '8' },
        { playerId: 'bob', value: '3' },
    ],
    myVote: '8',
    result: {
        average: 5.5,
        median: 5.5,
        spread: { min: 3, max: 8 },
        agreement: 0.5,
        outliers: { low: ['bob'], high: ['ada'] },
        distribution: [
            { value: '3', count: 1 },
            { value: '8', count: 1 },
        ],
        mode: ['3', '8'],
        consensus: false,
        nearestCard: '5',
    },
});

describe('RoomResult', () => {
    it('renders nothing while the round is open', () => {
        const { container } = renderInRoom(
            <RoomResult layout="bar" actions={roundActions()} />,
        );

        expect(
            container.querySelector('[data-slot="poker-result"]'),
        ).toBeNull();
    });

    it('is the section the browser suite reads, with the card of the viewer', () => {
        const { container } = renderInRoom(
            <RoomResult layout="bar" actions={roundActions()} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );
        const result = container.querySelector(
            '[aria-labelledby="poker-result"]',
        ) as HTMLElement;

        expect(within(result).getByText('Result · 2 votes')).toBeTruthy();
        expect(within(result).getByText('Nearest card: 5')).toBeTruthy();
        expect(within(result).getByText('50 % on 3, 8')).toBeTruthy();
        expect(
            within(result).getByText(
                'Bob (3) and Ada (8) open the discussion.',
            ),
        ).toBeTruthy();
        expect(
            container.querySelector('[data-slot="poker-dock-status"]')
                ?.textContent,
        ).toBe('Your card · 8');
    });

    it('says nothing of a card to who played none', () => {
        const { container } = renderInRoom(
            <RoomResult layout="bar" actions={roundActions()} />,
            pokerSnapshot({
                me: { isSpectator: true, canVote: false },
                current: {
                    taskId: 't1',
                    round: { ...revealed, myVote: null },
                },
            }),
        );

        expect(
            container.querySelector('[data-slot="poker-dock-status"]'),
        ).toBeNull();
    });

    it('names nobody on an anonymous round', () => {
        renderInRoom(
            <RoomResult layout="bar" actions={roundActions()} />,
            pokerSnapshot({
                current: {
                    taskId: 't1',
                    round: { ...revealed, anonymous: true },
                },
            }),
        );

        expect(screen.queryByText(/Bob \(3\)/)).toBeNull();
        expect(
            screen.getByText(
                'The lowest and the highest estimates open the discussion.',
            ),
        ).toBeTruthy();
    });

    it('on a phone, is a card with the final-estimate cards and without the buttons', () => {
        const { container } = renderInRoom(
            <RoomResult layout="card" actions={roundActions()} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        expect(
            container
                .querySelector('[data-slot="poker-result"]')
                ?.getAttribute('data-layout'),
        ).toBe('card');
        expect(
            screen.getByRole('radiogroup', { name: 'Final estimate' }),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^Validate/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Re-vote' })).toBeNull();
    });

    it('gives the tools to the facilitator only, and to nobody on an ended game', () => {
        const { unmount } = renderInRoom(
            <RoomResult layout="bar" actions={roundActions()} />,
            pokerSnapshot({
                me: { playerId: 'bob', isFacilitator: false },
                current: { taskId: 't1', round: revealed },
            }),
        );

        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Re-vote' })).toBeNull();
        unmount();

        renderInRoom(
            <RoomResult layout="bar" actions={roundActions()} />,
            pokerSnapshot({
                game: { endedAt: '2026-10-02T10:00:00Z' },
                current: { taskId: 't1', round: revealed },
            }),
        );

        expect(screen.getByText('Result · 2 votes')).toBeTruthy();
        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Re-vote' })).toBeNull();
    });
});
