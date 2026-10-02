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

    it('says "1 vote left" for a single vote', () => {
        renderWithProviders(<VoteBudget total={5} remaining={1} />);

        const budget = screen.getByRole('status');

        expect(budget.textContent).toContain('1 vote left');
        expect(budget.getAttribute('aria-label')).toBe('1 vote left of 5');
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

    it('says a detail after the dots, and has none by default', () => {
        const { container, rerender } = renderWithProviders(
            <VoteBudget total={5} remaining={2} detail="of 5" />,
        );

        expect(
            container.querySelector('[data-slot="vote-budget-detail"]')
                ?.textContent,
        ).toBe('of 5');

        rerender(<VoteBudget total={5} remaining={2} />);

        expect(
            container.querySelector('[data-slot="vote-budget-detail"]'),
        ).toBeNull();
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

    it('says "Total hidden" for a null total, unless the host leaves it out', () => {
        const votes = (hiddenTotalNote?: boolean) => (
            <CardVotes
                mine={1}
                total={null}
                budgetLeft={3}
                hiddenTotalNote={hiddenTotalNote}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />
        );
        const { rerender } = renderWithProviders(votes());

        expect(screen.getByText('Total hidden')).toBeTruthy();

        rerender(votes(false));

        expect(screen.queryByText('Total hidden')).toBeNull();
    });

    it('closes for a reason of the host: no vote added, none taken back', () => {
        const onVote = vi.fn();
        const onUnvote = vi.fn();
        renderWithProviders(
            <CardVotes
                mine={1}
                total={3}
                budgetLeft={3}
                disabledReason="Board closed for editing"
                onVote={onVote}
                onUnvote={onUnvote}
            />,
        );

        const button = screen.getByRole('button', { name: 'Add a vote' });
        const wrapper = screen.getByRole('group', {
            name: 'Board closed for editing',
        });

        fireEvent.click(button);
        fireEvent.keyDown(wrapper, { key: 'V', shiftKey: true });

        expect((button as HTMLButtonElement).disabled).toBe(true);
        expect(
            screen.queryByRole('button', { name: 'Remove a vote' }),
        ).toBeNull();
        expect(screen.getByRole('img', { name: 'Your votes: 1' })).toBeTruthy();
        expect(onVote).not.toHaveBeenCalled();
        expect(onUnvote).not.toHaveBeenCalled();
    });

    it('keeps the focus on the vote button when the last vote is taken back', () => {
        const votes = (mine: number) => (
            <CardVotes
                mine={mine}
                total={mine}
                budgetLeft={3}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />
        );
        const { rerender } = renderWithProviders(votes(1));
        const remove = screen.getByRole('button', { name: 'Remove a vote' });

        remove.focus();
        fireEvent.click(remove);
        rerender(votes(0));

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Add a vote' }),
        );
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
        expect(
            screen
                .getByRole('group', { name: 'You have used all your votes' })
                .getAttribute('tabindex'),
        ).toBe('0');
        expect(button.closest('[data-slot="vote-button-wrapper"]')).toBe(
            screen.getByRole('group', { name: 'You have used all your votes' }),
        );
        expect(onVote).not.toHaveBeenCalled();
    });

    it('moves the focus to the named wrapper when the press spends the last vote, so Shift+V still works', () => {
        const onUnvote = vi.fn();
        const votes = (mine: number, budgetLeft: number) => (
            <CardVotes
                mine={mine}
                total={mine}
                budgetLeft={budgetLeft}
                onVote={vi.fn()}
                onUnvote={onUnvote}
            />
        );
        const { rerender } = renderWithProviders(votes(0, 1));
        const button = screen.getByRole('button', { name: 'Add a vote' });

        button.focus();
        fireEvent.click(button);
        rerender(votes(1, 0));

        const wrapper = screen.getByRole('group', {
            name: 'You have used all your votes',
        });

        expect(document.activeElement).toBe(wrapper);

        fireEvent.keyDown(wrapper, { key: 'V', shiftKey: true });

        expect(onUnvote).toHaveBeenCalledTimes(1);
    });

    it('leaves the focus alone when the budget runs out while it is elsewhere', () => {
        const votes = (budgetLeft: number) => (
            <>
                <button type="button">Elsewhere</button>
                <CardVotes
                    mine={0}
                    total={0}
                    budgetLeft={budgetLeft}
                    onVote={vi.fn()}
                    onUnvote={vi.fn()}
                />
            </>
        );
        const { rerender } = renderWithProviders(votes(1));
        const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });

        elsewhere.focus();
        rerender(votes(0));

        expect(document.activeElement).toBe(elsewhere);
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
