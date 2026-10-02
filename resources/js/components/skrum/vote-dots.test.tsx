import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CardVotes, VoteBudget } from '@/components/skrum/vote-dots';
import { renderWithProviders } from '@/test/render';

function filledDots(container: HTMLElement): number {
    return container.querySelectorAll(
        '[data-slot="vote-dot"][data-filled="true"]',
    ).length;
}

describe('VoteBudget', () => {
    it('shows remaining votes with one dot per budget vote', () => {
        const { container } = renderWithProviders(
            <VoteBudget total={5} remaining={2} />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            '2 votes left',
        );
        expect(
            container.querySelectorAll('[data-slot="vote-dot"]'),
        ).toHaveLength(5);
        expect(filledDots(container)).toBe(2);
    });

    it('says no votes left with all dots empty at zero', () => {
        const { container } = renderWithProviders(
            <VoteBudget total={5} remaining={0} />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            'No votes left',
        );
        expect(filledDots(container)).toBe(0);
    });

    it('clamps remaining to the budget', () => {
        const { container } = renderWithProviders(
            <VoteBudget total={3} remaining={9} />,
        );

        expect(filledDots(container)).toBe(3);
    });
});

describe('CardVotes', () => {
    it('names the vote button "Add a vote", reads the total next to it and presses it when I voted', () => {
        renderWithProviders(
            <CardVotes
                mine={2}
                total={6}
                budgetLeft={3}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />,
        );

        const button = screen.getByRole('button', { name: 'Add a vote' });

        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByText('6 votes')).toBeTruthy();
    });

    it('calls onVote and onUnvote', () => {
        const onVote = vi.fn();
        const onUnvote = vi.fn();
        renderWithProviders(
            <CardVotes
                mine={1}
                total={3}
                budgetLeft={3}
                onVote={onVote}
                onUnvote={onUnvote}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Add a vote' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove a vote' }));

        expect(onVote).toHaveBeenCalledTimes(1);
        expect(onUnvote).toHaveBeenCalledTimes(1);
    });

    it('disables the vote button when no budget is left and keeps the reason reachable', () => {
        const onVote = vi.fn();
        renderWithProviders(
            <CardVotes
                mine={0}
                total={2}
                budgetLeft={0}
                onVote={onVote}
                onUnvote={vi.fn()}
            />,
        );

        const button = screen.getByRole('button', { name: 'Add a vote' });
        fireEvent.click(button);

        expect((button as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('You have used all your votes')).toBeTruthy();
        expect(
            button
                .closest('[data-slot="vote-button-wrapper"]')
                ?.getAttribute('tabindex'),
        ).toBe('0');
        expect(onVote).not.toHaveBeenCalled();
    });

    it('blocks voting once the max per card is reached', () => {
        const onVote = vi.fn();
        renderWithProviders(
            <CardVotes
                mine={3}
                total={5}
                maxPerCard={3}
                budgetLeft={4}
                onVote={onVote}
                onUnvote={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Add a vote' }));

        expect(onVote).not.toHaveBeenCalled();
    });

    it('allows voting below the max per card', () => {
        const onVote = vi.fn();
        renderWithProviders(
            <CardVotes
                mine={2}
                total={5}
                maxPerCard={3}
                budgetLeft={4}
                onVote={onVote}
                onUnvote={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Add a vote' }));

        expect(onVote).toHaveBeenCalledTimes(1);
    });

    it('never shows the total when it is hidden', () => {
        const { container } = renderWithProviders(
            <CardVotes
                mine={1}
                total={null}
                budgetLeft={2}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />,
        );

        expect(screen.getByText('Total hidden')).toBeTruthy();
        expect(container.querySelector('[data-slot="vote-count"]')).toBeNull();
        expect(screen.getByRole('button', { name: 'Add a vote' })).toBeTruthy();
    });

    it('hides the remove button and my dots when I have no vote', () => {
        const { container } = renderWithProviders(
            <CardVotes
                mine={0}
                total={4}
                budgetLeft={2}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />,
        );

        expect(
            screen.queryByRole('button', { name: 'Remove a vote' }),
        ).toBeNull();
        expect(filledDots(container)).toBe(0);
        expect(
            screen
                .getByRole('button', { name: 'Add a vote' })
                .getAttribute('aria-pressed'),
        ).toBe('false');
    });

    it('votes with V and removes with Shift+V on the focused control', () => {
        const onVote = vi.fn();
        const onUnvote = vi.fn();
        renderWithProviders(
            <CardVotes
                mine={1}
                total={2}
                budgetLeft={2}
                onVote={onVote}
                onUnvote={onUnvote}
            />,
        );
        const button = screen.getByRole('button', { name: 'Add a vote' });

        fireEvent.keyDown(button, { key: 'v' });
        fireEvent.keyDown(button, { key: 'V', shiftKey: true });

        expect(onVote).toHaveBeenCalledTimes(1);
        expect(onUnvote).toHaveBeenCalledTimes(1);
    });

    it('pops only the newly added dot', () => {
        function Harness() {
            const [mine, setMine] = useState(1);

            return (
                <CardVotes
                    mine={mine}
                    total={mine}
                    budgetLeft={3}
                    onVote={() => setMine(mine + 1)}
                    onUnvote={() => setMine(mine - 1)}
                />
            );
        }
        const { container } = renderWithProviders(<Harness />);

        expect(container.querySelectorAll('.animate-vote-pop')).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'Add a vote' }));

        expect(
            container.querySelectorAll('[data-slot="vote-dot"]'),
        ).toHaveLength(2);
        expect(container.querySelectorAll('.animate-vote-pop')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'Remove a vote' }));

        expect(container.querySelectorAll('.animate-vote-pop')).toHaveLength(0);
    });
});
