import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PokerTable } from '@/components/skrum/poker-table';
import type {
    PokerResult,
    PokerSeat,
    PokerTableProps,
} from '@/components/skrum/poker-table';
import { renderWithProviders } from '@/test/render';

function seat(
    index: number,
    state: PokerSeat['state'],
    value?: string,
    name = `Person${index}`,
): PokerSeat {
    return {
        user: {
            id: `u${index}`,
            name,
            initials: name.slice(0, 2),
            presence: (index % 12) + 1,
            role: 'member',
            status: 'online',
        },
        state,
        value,
    };
}

const story = { key: 'ATLAS-1290', title: 'Export CSV' };

const dispersion: PokerResult = {
    mean: 7.9,
    median: 5,
    mode: '5',
    agreement: 0.43,
    consensus: false,
    distribution: [
        { value: '3', count: 1 },
        { value: '5', count: 3 },
        { value: '8', count: 2 },
        { value: '21', count: 1 },
    ],
    outliers: ['u1', 'u2'],
};

const consensus: PokerResult = {
    mean: 7.5,
    median: 8,
    mode: '8',
    agreement: 0.83,
    consensus: true,
    distribution: [
        { value: '5', count: 1 },
        { value: '8', count: 5 },
    ],
    outliers: [],
};

function renderTable(props: Partial<PokerTableProps> = {}) {
    return renderWithProviders(
        <PokerTable
            story={story}
            seats={[
                seat(0, 'voted', undefined, 'Camille'),
                seat(1, 'waiting', undefined, 'Theo'),
                seat(2, 'absent', undefined, 'Malik'),
                seat(3, 'voted', undefined, 'Sofia'),
            ]}
            revealed={false}
            {...props}
        />,
    );
}

describe('PokerTable while voting', () => {
    it('names the table with the story and announces each seat state', () => {
        renderTable();

        expect(
            screen.getByRole('group', { name: 'Poker table, ATLAS-1290' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('group', { name: 'Camille, voted' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('group', { name: 'Theo, thinking' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('group', { name: 'Malik, absent' }),
        ).toBeTruthy();
    });

    it('announces progress excluding absent seats and shows no mean', () => {
        renderTable();

        expect(screen.getByRole('status').textContent).toBe('2 of 3 voted');
        expect(screen.queryByText('Mean')).toBeNull();
    });

    it('hides card values before the reveal', () => {
        const { container } = renderTable({
            seats: [seat(0, 'voted', '8', 'Camille')],
        });

        expect(
            container.querySelector('[data-slot="poker-card"]')?.textContent,
        ).toBe('');
    });

    it('reveals through the button and the R key for the facilitator only', () => {
        const onReveal = vi.fn();
        const { unmount } = renderTable({ isFacilitator: true, onReveal });

        fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
        fireEvent.keyDown(document, { key: 'r' });

        expect(onReveal).toHaveBeenCalledTimes(2);
        unmount();

        const guestReveal = vi.fn();
        renderTable({ onReveal: guestReveal });
        fireEvent.keyDown(document, { key: 'r' });

        expect(screen.queryByRole('button', { name: 'Reveal' })).toBeNull();
        expect(guestReveal).not.toHaveBeenCalled();
    });
});

describe('PokerTable revealed', () => {
    const seats = [
        seat(0, 'voted', '5', 'Camille'),
        seat(1, 'voted', '21', 'Yuki'),
        seat(2, 'voted', '3', 'Lucas'),
        seat(3, 'voted', '☕', 'Malik'),
    ];

    it('shows server statistics as given with the discussion badge', () => {
        renderTable({ seats, revealed: true, result: dispersion });

        expect(screen.getAllByText('7.9').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Needs discussion').length).toBeGreaterThan(
            0,
        );
        expect(screen.getByText('43%')).toBeTruthy();
        expect(screen.getByText('Result · 7 votes')).toBeTruthy();
        expect(
            screen.getByText(
                'Yuki (21) and Lucas (3) explain their estimates, then we revote.',
            ),
        ).toBeTruthy();
    });

    it('marks outlier cards and names them for assistive tech', () => {
        const { container } = renderTable({
            seats,
            revealed: true,
            result: dispersion,
        });

        expect(
            container.querySelectorAll(
                '[data-slot="poker-card"][data-outlier]',
            ),
        ).toHaveLength(2);
        expect(
            screen.getByRole('group', { name: 'Yuki, 21, worth discussing' }),
        ).toBeTruthy();
        expect(screen.getByRole('group', { name: 'Malik, ☕' })).toBeTruthy();
    });

    it('renders a dash when the mean is null', () => {
        renderTable({
            seats,
            revealed: true,
            result: { ...dispersion, mean: null, median: null },
        });

        expect(screen.getAllByText('–').length).toBeGreaterThan(0);
    });

    it('describes the distribution and offers a table view', () => {
        renderTable({ seats, revealed: true, result: dispersion });

        expect(
            screen.getByRole('img', {
                name: 'Distribution: 3 × 1, 5 × 3, 8 × 2, 21 × 1',
            }),
        ).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'View as table' }));

        const table = screen.getByRole('table');
        expect(within(table).getByText('21')).toBeTruthy();
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('offers revote and keep on dispersion, calling back', () => {
        const onRevote = vi.fn();
        const onAccept = vi.fn();
        renderTable({
            seats,
            revealed: true,
            result: dispersion,
            isFacilitator: true,
            onRevote,
            onAccept,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Revote' }));
        fireEvent.click(screen.getByRole('button', { name: 'Keep 5' }));

        expect(onRevote).toHaveBeenCalledTimes(1);
        expect(onAccept).toHaveBeenCalledWith('5');
    });

    it('shows consensus with accept and next, and keyboard shortcuts', () => {
        const onAccept = vi.fn();
        const onNext = vi.fn();
        renderTable({
            seats,
            revealed: true,
            result: consensus,
            isFacilitator: true,
            onAccept,
            onNext,
        });

        expect(screen.getAllByText('Consensus').length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: 'Revote' })).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Accept 8 points' }),
        );
        fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
        fireEvent.keyDown(document, { key: 'n' });

        expect(onAccept).toHaveBeenCalledTimes(2);
        expect(onAccept).toHaveBeenCalledWith('8');
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('hides facilitator actions from other participants', () => {
        renderTable({ seats, revealed: true, result: dispersion });

        expect(screen.queryByRole('button', { name: 'Revote' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Keep 5' })).toBeNull();
    });
});

describe('PokerTable layout', () => {
    it('uses the oval up to 12 seats and a seat grid beyond', () => {
        const twelve = Array.from({ length: 12 }, (_, i) => seat(i, 'waiting'));
        const { container, unmount } = renderTable({ seats: twelve });

        expect(container.querySelector('[data-layout="oval"]')).not.toBeNull();
        expect(
            container.querySelector('[data-slot="poker-oval"]'),
        ).not.toBeNull();
        unmount();

        const thirteen = Array.from({ length: 13 }, (_, i) =>
            seat(i, 'waiting'),
        );
        const grid = renderTable({ seats: thirteen });

        expect(
            grid.container.querySelector('[data-layout="grid"]'),
        ).not.toBeNull();
        expect(
            grid.container.querySelector('[data-slot="poker-oval"]'),
        ).toBeNull();
        expect(
            grid.container.querySelectorAll('[data-slot="poker-seat"]'),
        ).toHaveLength(13);
    });
});
