import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PokerRounds } from '@/components/skrum/poker-rounds';
import type { PokerRound } from '@/lib/poker/types';
import { renderWithProviders } from '@/test/render';

function round(overrides: Partial<PokerRound> = {}): PokerRound {
    return {
        id: 'r1',
        number: 1,
        anonymous: false,
        revealedAt: '2026-10-02T09:00:00Z',
        revealReason: 'manual',
        timerEndsAt: null,
        version: 1,
        votesCount: 3,
        votes: [
            { playerId: 'p1', value: '3' },
            { playerId: 'p2', value: '5' },
            { playerId: 'p3', value: '13' },
        ],
        myVote: null,
        result: {
            average: 7,
            mode: ['3', '5', '13'],
            consensus: false,
            nearestCard: '8',
            distribution: [
                { value: '3', count: 1 },
                { value: '5', count: 1 },
                { value: '8', count: 0 },
                { value: '13', count: 1 },
            ],
        },
        ...overrides,
    };
}

const consensusRound = round({
    id: 'r2',
    number: 2,
    votes: [
        { playerId: 'p1', value: '5' },
        { playerId: 'p2', value: '5' },
        { playerId: 'p3', value: null },
    ],
    result: {
        average: 5,
        mode: ['5'],
        consensus: true,
        nearestCard: '5',
        distribution: [{ value: '5', count: 2 }],
    },
});

const players = [
    { id: 'p1', name: 'Ada' },
    { id: 'p2', name: 'Bob' },
];

function rounds(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll<HTMLElement>('[data-slot="poker-round"]'),
    );
}

describe('PokerRounds', () => {
    it('is collapsed by default, with the count in the trigger', () => {
        renderWithProviders(
            <PokerRounds
                rounds={[consensusRound, round()]}
                players={players}
            />,
        );
        const trigger = screen.getByRole('button', { name: 'Rounds (2)' });

        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(rounds()).toHaveLength(0);

        fireEvent.click(trigger);

        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(rounds()).toHaveLength(2);
    });

    it('lists each vote next to its player, in the order given', () => {
        renderWithProviders(
            <PokerRounds
                rounds={[consensusRound, round()]}
                players={players}
                defaultOpen
            />,
        );
        const [second, first] = rounds();

        expect(within(second).getByText('Round 2')).toBeTruthy();
        expect(within(second).getByText('Consensus · 5')).toBeTruthy();
        expect(within(second).getByText('Average: 5')).toBeTruthy();
        expect(
            within(second)
                .getAllByRole('listitem')
                .map((item) => item.textContent),
        ).toEqual(['5Ada', '5Bob', '—Former member']);
        expect(within(first).getByText('Spread 3 → 13')).toBeTruthy();
        expect(within(first).getByText('3 votes')).toBeTruthy();
    });

    it('lists an anonymous round by value in deck order, without any name', () => {
        renderWithProviders(
            <PokerRounds
                rounds={[
                    round({
                        anonymous: true,
                        votes: [
                            { playerId: 'p2', value: '13' },
                            { playerId: 'p1', value: '3' },
                        ],
                    }),
                ]}
                players={players}
                defaultOpen
            />,
        );
        const list = screen.getByRole('list', { name: 'Anonymous votes' });

        expect(
            within(list)
                .getAllByRole('listitem')
                .map((item) => item.textContent),
        ).toEqual(['3', '5', '13']);
        expect(screen.queryByText('Ada')).toBeNull();
        expect(screen.queryByText('Bob')).toBeNull();
    });

    it('shows only the vote count of a round that is not revealed', () => {
        renderWithProviders(
            <PokerRounds
                rounds={[
                    round({
                        revealedAt: null,
                        result: null,
                        votes: [{ playerId: 'p1', value: null }],
                        votesCount: 1,
                    }),
                ]}
                players={players}
                defaultOpen
            />,
        );

        expect(screen.getByText('Not revealed · 1 votes')).toBeTruthy();
        expect(screen.queryByText('Ada')).toBeNull();
        expect(
            document.querySelector('[data-slot="poker-round-card"]'),
        ).toBeNull();
    });

    it('shows the most played cards for a non-numeric deck and says when nothing counts', () => {
        renderWithProviders(
            <PokerRounds
                isNumeric={false}
                rounds={[
                    round({
                        result: {
                            average: null,
                            mode: ['M'],
                            consensus: false,
                            nearestCard: null,
                            distribution: [
                                { value: 'S', count: 1 },
                                { value: 'M', count: 2 },
                                { value: '?', count: 1 },
                            ],
                        },
                    }),
                    round({
                        id: 'r3',
                        number: 3,
                        result: {
                            average: null,
                            mode: [],
                            consensus: false,
                            nearestCard: null,
                            distribution: [{ value: '?', count: 2 }],
                        },
                    }),
                ]}
                defaultOpen
            />,
        );

        expect(screen.getByText('Spread S → M')).toBeTruthy();
        expect(screen.getByText('Most played: M')).toBeTruthy();
        expect(screen.getByText('No countable votes')).toBeTruthy();
    });

    it('has empty, loading and failed states and keeps the count given', () => {
        const { rerender } = renderWithProviders(
            <PokerRounds rounds={[]} defaultOpen />,
        );

        expect(screen.getByRole('button', { name: 'Rounds (0)' })).toBeTruthy();
        expect(screen.getByText('No rounds yet.')).toBeTruthy();

        rerender(
            <PokerRounds rounds={[]} count={2} status="loading" defaultOpen />,
        );

        expect(screen.getByRole('button', { name: 'Rounds (2)' })).toBeTruthy();
        expect(
            document.querySelector('[data-slot="poker-rounds-loading"]'),
        ).not.toBeNull();
        expect(screen.queryByText('No rounds yet.')).toBeNull();

        rerender(
            <PokerRounds rounds={[]} count={2} status="failed" defaultOpen />,
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'Could not load the rounds.',
        );
    });

    it('counts a new round without opening and follows a controlled open state', () => {
        const onOpenChange = vi.fn();
        const { rerender } = renderWithProviders(
            <PokerRounds
                rounds={[round()]}
                open={false}
                onOpenChange={onOpenChange}
            />,
        );

        rerender(
            <PokerRounds
                rounds={[consensusRound, round()]}
                open={false}
                onOpenChange={onOpenChange}
            />,
        );

        const trigger = screen.getByRole('button', { name: 'Rounds (2)' });

        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(trigger);

        expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('holds 200 rounds, 13 voters and a 60-character name', () => {
        const longName = 'N'.repeat(60);
        const voters = Array.from({ length: 13 }, (_, index) => ({
            id: `v${index}`,
            name: index === 0 ? longName : `Voter ${index}`,
        }));
        const many = Array.from({ length: 200 }, (_, index) =>
            round({
                id: `r${index}`,
                number: 200 - index,
                votesCount: 13,
                votes: voters.map((voter) => ({
                    playerId: voter.id,
                    value: 'ABCDEFGH',
                })),
            }),
        );

        renderWithProviders(
            <PokerRounds rounds={many} players={voters} defaultOpen />,
        );

        expect(
            screen.getByRole('button', { name: 'Rounds (200)' }),
        ).toBeTruthy();
        expect(rounds()).toHaveLength(200);
        expect(within(rounds()[0]).getAllByRole('listitem')).toHaveLength(13);
        expect(within(rounds()[0]).getByText(longName).className).toContain(
            'truncate',
        );
    });
});
