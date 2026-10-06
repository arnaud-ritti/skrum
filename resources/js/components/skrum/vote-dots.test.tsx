import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardVotes, VoteBudget } from '@/components/skrum/vote-dots';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';
import { renderWithProviders } from '@/test/render';

function filledDots(container: HTMLElement): number {
    return container.querySelectorAll(
        '[data-slot="vote-dot"][data-filled="true"]',
    ).length;
}

afterEach(() => {
    setSingleKeyShortcuts(true);
});

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

        expect(budget.textContent).toContain('1 vote left of 5');
    });

    it('lets the detail reach assistive tech instead of naming the region over it', () => {
        renderWithProviders(
            <VoteBudget total={5} remaining={2} detail="Three per card" />,
        );

        const budget = screen.getByRole('status');

        expect(budget.hasAttribute('aria-label')).toBe(false);
        expect(budget.textContent).toContain('2 votes left of 5');
        expect(budget.textContent).toContain('Three per card');
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
    const slot = (container: HTMLElement, name: string) =>
        container.querySelector<HTMLElement>(`[data-slot="${name}"]`);

    it('names the vote button "Add a vote", reads the total next to it and is no toggle', () => {
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

        expect(button.hasAttribute('aria-pressed')).toBe(false);
        expect(screen.getByRole('img', { name: '6 votes' })).toBeTruthy();
    });

    it("shows the card's total apart from the stepper, and a lock while totals are hidden", () => {
        const votes = (total: number | null) => (
            <CardVotes
                mine={1}
                total={total}
                budgetLeft={3}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />
        );
        const { container, rerender } = renderWithProviders(votes(7));
        const total = screen.getByRole('img', { name: '7 votes' });
        const stepper = slot(container, 'vote-stepper');

        expect(total.textContent).toBe('7');
        expect(total.getAttribute('title')).toBe('7 votes');
        expect(total.classList.contains('tabular-nums')).toBe(true);
        expect(total.classList.contains('text-muted-foreground')).toBe(true);
        expect(total.closest('button')).toBeNull();
        expect(stepper?.contains(total)).toBe(false);
        expect(total.nextElementSibling).toBe(stepper);

        rerender(votes(1));

        expect(screen.getByRole('img', { name: '1 vote' })).toBeTruthy();

        rerender(votes(null));

        const lock = screen.getByRole('img', {
            name: 'Total hidden until reveal',
        });

        expect(lock.textContent).toBe('');
        expect(lock.querySelector('svg')).not.toBeNull();
        expect(lock.nextElementSibling).toBe(stepper);
        expect(slot(container, 'vote-total')).toBeNull();
    });

    it('offers Vote alone when none of my votes is on the card', () => {
        const { container } = renderWithProviders(
            <CardVotes
                mine={0}
                total={4}
                budgetLeft={2}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />,
        );
        const stepper = slot(container, 'vote-stepper');

        expect(stepper?.querySelectorAll('button')).toHaveLength(1);
        expect(
            screen.getByRole('button', { name: 'Add a vote' }).textContent,
        ).toBe('Vote');
        expect(stepper?.hasAttribute('data-mine')).toBe(false);
        expect(stepper?.classList.contains('bg-skrum-primary-soft')).toBe(
            false,
        );
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows my votes as a number between remove and add', () => {
        const { container } = renderWithProviders(
            <CardVotes
                mine={3}
                total={7}
                budgetLeft={2}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />,
        );
        const stepper = slot(container, 'vote-stepper');

        expect(
            Array.from(stepper?.children ?? []).map(
                (part) => part.getAttribute('aria-label') ?? part.textContent,
            ),
        ).toEqual(['Remove a vote', 'Your votes: 3', 'Add a vote']);
        expect(stepper?.textContent).toBe('3');
        expect(stepper?.classList.contains('inline-flex')).toBe(true);
        expect(stepper?.classList.contains('shrink-0')).toBe(true);
        expect(stepper?.classList.contains('bg-skrum-primary-soft')).toBe(true);
        expect(stepper?.classList.contains('text-skrum-primary-text')).toBe(
            true,
        );
    });

    it('never renders a row of dots', () => {
        const { container } = renderWithProviders(
            <CardVotes
                mine={12}
                total={12}
                budgetLeft={3}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />,
        );

        expect(
            container.querySelectorAll('[data-slot="vote-dot"]'),
        ).toHaveLength(1);
        expect(slot(container, 'my-votes')?.textContent).toBe('12');
        expect(
            slot(container, 'my-votes')?.classList.contains('flex-wrap'),
        ).toBe(false);
    });

    it('announces my votes', () => {
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
        const mine = screen.getByRole('status', { name: 'Your votes: 1' });

        expect(mine.getAttribute('aria-live')).toBe('polite');

        rerender(votes(2));

        expect(screen.getByRole('status', { name: 'Your votes: 2' })).toBe(
            mine,
        );
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

    it('shows the lock of a null total, unless the host leaves it out', () => {
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
        const { container, rerender } = renderWithProviders(votes());

        expect(slot(container, 'hidden-total')).toBe(
            screen.getByRole('img', { name: 'Total hidden until reveal' }),
        );

        rerender(votes(false));

        expect(slot(container, 'hidden-total')).toBeNull();
        expect(screen.queryByRole('img')).toBeNull();
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

        const button = screen.getByRole('button', {
            name: 'Add a vote',
            description: 'Board closed for editing',
        });

        fireEvent.click(button);
        fireEvent.keyDown(button, { key: 'V', shiftKey: true });

        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(
            screen.queryByRole('button', { name: 'Remove a vote' }),
        ).toBeNull();
        expect(
            screen.getByRole('status', { name: 'Your votes: 1' }),
        ).toBeTruthy();
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

    it('turns add off with its reason when no vote is left', () => {
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

        const button = screen.getByRole('button', {
            name: 'Add a vote',
            description: 'You have used all your votes',
        }) as HTMLButtonElement;

        button.focus();
        fireEvent.click(button);

        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(button.disabled).toBe(false);
        expect(document.activeElement).toBe(button);
        expect(onVote).not.toHaveBeenCalled();
    });

    it("turns add off with its reason when the card's limit is reached", () => {
        const onVote = vi.fn();
        const onUnvote = vi.fn();
        renderWithProviders(
            <CardVotes
                mine={3}
                total={5}
                maxPerCard={3}
                budgetLeft={4}
                onVote={onVote}
                onUnvote={onUnvote}
            />,
        );

        const button = screen.getByRole('button', {
            name: 'Add a vote',
            description: 'You reached the limit of 3 votes on this card',
        }) as HTMLButtonElement;

        fireEvent.click(button);
        fireEvent.click(screen.getByRole('button', { name: 'Remove a vote' }));

        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(button.disabled).toBe(false);
        expect(onVote).not.toHaveBeenCalled();
        expect(onUnvote).toHaveBeenCalledTimes(1);
    });

    it('shows the reason in the tooltip of an add that is off', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <CardVotes
                mine={0}
                total={2}
                budgetLeft={0}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />,
        );

        await user.hover(screen.getByRole('button', { name: 'Add a vote' }));

        expect((await screen.findByRole('tooltip')).textContent).toBe(
            'You have used all your votes',
        );
    });

    it('keeps the focus on add when the press spends the last vote, so Shift+V still works', () => {
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

        expect(document.activeElement).toBe(button);
        expect(
            screen.getByRole('button', {
                name: 'Add a vote',
                description: 'You have used all your votes',
            }),
        ).toBe(button);

        fireEvent.keyDown(button, { key: 'V', shiftKey: true });

        expect(onUnvote).toHaveBeenCalledTimes(1);
    });

    it('moves the focus to add when the last vote is taken back from a spent budget', () => {
        const votes = (mine: number, budgetLeft: number) => (
            <CardVotes
                mine={mine}
                total={mine}
                budgetLeft={budgetLeft}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />
        );
        const { rerender } = renderWithProviders(votes(1, 0));
        const add = screen.getByRole('button', { name: 'Add a vote' });

        fireEvent.click(screen.getByRole('button', { name: 'Remove a vote' }));

        expect(document.activeElement).toBe(add);

        rerender(votes(0, 1));

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Add a vote' }),
        );
        expect(add.hasAttribute('aria-disabled')).toBe(false);
    });

    it('adds one vote per press of V, not one per key repeat', () => {
        const onVote = vi.fn();
        renderWithProviders(
            <CardVotes
                mine={0}
                total={0}
                budgetLeft={5}
                onVote={onVote}
                onUnvote={vi.fn()}
            />,
        );
        const button = screen.getByRole('button', { name: 'Add a vote' });

        fireEvent.keyDown(button, { key: 'v' });
        fireEvent.keyDown(button, { key: 'v', repeat: true });
        fireEvent.keyDown(button, { key: 'v', repeat: true });

        expect(onVote).toHaveBeenCalledTimes(1);
    });

    it('leaves the V shortcut out of the tooltip when single-key shortcuts are off', async () => {
        const user = userEvent.setup();
        setSingleKeyShortcuts(false);
        renderWithProviders(
            <CardVotes
                mine={0}
                total={0}
                budgetLeft={5}
                onVote={vi.fn()}
                onUnvote={vi.fn()}
            />,
        );

        await user.hover(screen.getByRole('button', { name: 'Add a vote' }));

        expect((await screen.findByRole('tooltip')).textContent).toBe('Vote');
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

        expect(slot(container, 'hidden-total')).not.toBeNull();
        expect(slot(container, 'vote-total')).toBeNull();
        expect(container.textContent).toBe('1');
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

    it('pops the dot when a vote of mine is added, not when one is taken back', () => {
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
        ).toHaveLength(1);
        expect(container.querySelectorAll('.animate-vote-pop')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'Remove a vote' }));

        expect(container.querySelectorAll('.animate-vote-pop')).toHaveLength(0);
    });
});

describe('CardVotes on a phone', () => {
    it('gives the vote and its take-back a 44px target below md', () => {
        const votes = (mine: number) => (
            <CardVotes
                mine={mine}
                total={3}
                budgetLeft={2}
                onVote={() => {}}
                onUnvote={() => {}}
            />
        );
        const { rerender } = renderWithProviders(votes(1));

        for (const name of ['Add a vote', 'Remove a vote']) {
            expect(screen.getByRole('button', { name }).className).toContain(
                'max-md:size-11',
            );
        }

        rerender(votes(0));

        const vote = screen.getByRole('button', { name: 'Add a vote' });

        expect(vote.className).toContain('max-md:h-11');
        expect(vote.className).toContain('max-md:min-w-11');
    });
});
