import { fireEvent, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RetroCard } from '@/components/skrum/retro-card';
import type { RetroCardProps } from '@/components/skrum/retro-card';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';
import { renderWithProviders } from '@/test/render';

const author = {
    id: 'u1',
    name: 'Camille Roux',
    presence: 4,
} as const;

function card(props: Partial<RetroCardProps> = {}) {
    return (
        <RetroCard
            id="c1"
            text="The demo went well"
            color="moss"
            author={author}
            {...props}
        />
    );
}

describe('RetroCard', () => {
    afterEach(() => {
        setSingleKeyShortcuts(true);
    });

    it('counts a single vote in the singular and marks selection without aria-selected', () => {
        renderWithProviders(
            card({ votes: { total: 1, mine: 0 }, selected: true }),
        );
        const article = screen.getByRole('article');

        expect(article.getAttribute('aria-label')).toContain('1 vote');
        expect(article.getAttribute('aria-label')).not.toContain('1 votes');
        expect(article.hasAttribute('aria-selected')).toBe(false);
        expect(article.getAttribute('aria-label')).toContain('Selected');
    });

    it('labels the article with text, author and votes', () => {
        renderWithProviders(card({ votes: { total: 3, mine: 0 } }));

        expect(
            screen.getByRole('article', {
                name: 'The demo went well, Camille Roux, 3 votes',
            }),
        ).toBeTruthy();
    });

    it('carries the DOM id the browser suite binds to', () => {
        const { rerender } = renderWithProviders(card());

        expect(screen.getByRole('article').id).toBe('card-c1');

        rerender(card({ domId: 'preview-c1' }));

        expect(screen.getByRole('article').id).toBe('preview-c1');
    });

    it('lets the host rename the vote button', () => {
        renderWithProviders(
            card({
                votes: { total: 1, mine: 0 },
                labels: { vote: 'Vote for this idea' },
            }),
        );

        expect(
            screen.getByRole('button', { name: 'Vote for this idea' }),
        ).toBeTruthy();
    });

    it('names the editing field "Card text", or as the host says', () => {
        const { rerender } = renderWithProviders(card({ editing: true }));

        expect(screen.getByRole('textbox', { name: 'Card text' })).toBeTruthy();

        rerender(card({ editing: true, labels: { editor: 'Add a card…' } }));

        expect(
            screen
                .getByRole('textbox', { name: 'Add a card…' })
                .getAttribute('placeholder'),
        ).toBe('Add a card…');
    });

    it('takes the focus when editing starts, unless the host keeps it', () => {
        const { unmount } = renderWithProviders(card({ editing: true }));

        expect(document.activeElement).toBe(screen.getByRole('textbox'));

        unmount();
        renderWithProviders(card({ editing: true, autoFocusEditor: false }));

        expect(document.activeElement).not.toBe(screen.getByRole('textbox'));
    });

    it('shows Anonymous instead of the author', () => {
        renderWithProviders(card({ author: null }));

        expect(screen.getByText('Anonymous')).toBeTruthy();
        expect(screen.queryByText('Camille')).toBeNull();
    });

    it('masks the text from assistive tech until the reveal', () => {
        renderWithProviders(
            card({ masked: true, votes: { total: 2, mine: 0 } }),
        );

        expect(
            screen.getByRole('article', {
                name: 'Card hidden until the reveal',
            }),
        ).toBeTruthy();
        expect(screen.getByText('Hidden until the reveal')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Vote/ })).toBeNull();
    });

    it('never puts the text or the GIF of a masked card in the DOM', () => {
        const { container } = renderWithProviders(
            card({
                masked: true,
                text: 'A secret nobody may read',
                gif: { previewUrl: '/secret-preview.gif', url: '/secret.gif' },
                insight: { sentiment: 'negative', category: 'Secret topic' },
                commentCount: 2,
            }),
        );

        expect(screen.queryByText('A secret nobody may read')).toBeNull();
        expect(container.textContent).not.toContain('secret');
        expect(container.innerHTML).not.toContain('A secret nobody may read');
        expect(container.innerHTML).not.toContain('secret-preview.gif');
        expect(container.innerHTML).not.toContain('Secret topic');
        expect(container.querySelector('img')).toBeNull();
    });

    it("shows the card's total apart from the stepper, and a lock while totals are hidden", () => {
        const { rerender } = renderWithProviders(
            card({ votes: { total: 7, mine: 2 }, canVote: true }),
        );
        const unit = () =>
            screen
                .getByRole('article')
                .querySelector('[data-slot="retro-card-vote-unit"]');
        const stepper = () =>
            unit()?.querySelector('[data-slot="vote-stepper"]');
        const total = screen.getByRole('img', { name: '7 votes' });

        expect(total.textContent).toBe('7');
        expect(total.closest('button')).toBeNull();
        expect(unit()?.firstElementChild).toBe(total);
        expect(total.nextElementSibling).toBe(stepper());
        expect(unit()?.lastElementChild).toBe(stepper());

        rerender(card({ votes: { total: null, mine: 2 }, canVote: true }));

        const lock = screen.getByRole('img', {
            name: 'Total hidden until reveal',
        });

        expect(lock.textContent).toBe('');
        expect(unit()?.firstElementChild).toBe(lock);
        expect(screen.getByRole('button', { name: 'Add a vote' })).toBeTruthy();
        expect(
            screen.getByRole('status', { name: 'Your votes: 2' }),
        ).toBeTruthy();
    });

    it('offers Vote alone when none of my votes is on the card', () => {
        const { rerender } = renderWithProviders(
            card({ votes: { total: null, mine: 0 }, canVote: true }),
        );
        const add = () => screen.getByRole('button', { name: 'Add a vote' });

        expect(add().textContent).toBe('Vote');

        rerender(card({ votes: { total: 4, mine: 0 }, canVote: true }));

        expect(add().textContent).toBe('Vote');
        expect(add().hasAttribute('aria-pressed')).toBe(false);
        expect(
            add()
                .closest('[data-slot="vote-stepper"]')
                ?.querySelectorAll('button'),
        ).toHaveLength(1);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows my votes as a number between remove and add', () => {
        renderWithProviders(
            card({ votes: { total: 7, mine: 3 }, canVote: true }),
        );
        const stepper = screen
            .getByRole('article')
            .querySelector('[data-slot="vote-stepper"]');

        expect(
            Array.from(stepper?.children ?? []).map(
                (part) => part.getAttribute('aria-label') ?? part.textContent,
            ),
        ).toEqual(['Remove a vote', 'Your votes: 3', 'Add a vote']);
        expect(stepper?.textContent).toBe('3');
        expect(stepper?.classList.contains('bg-skrum-primary-soft')).toBe(true);
    });

    it('never renders a row of dots', () => {
        renderWithProviders(
            card({ votes: { total: 12, mine: 12 }, canVote: true }),
        );
        const article = screen.getByRole('article');

        expect(article.querySelectorAll('[data-slot="vote-dot"]')).toHaveLength(
            1,
        );
        expect(
            screen.getByRole('status', { name: 'Your votes: 12' }).textContent,
        ).toBe('12');
    });

    it('announces my votes', () => {
        renderWithProviders(
            card({ votes: { total: 3, mine: 1 }, canVote: true }),
        );

        expect(
            screen
                .getByRole('status', { name: 'Your votes: 1' })
                .getAttribute('aria-live'),
        ).toBe('polite');
    });

    it('votes with V and removes with Shift+V', () => {
        const onVote = vi.fn();
        renderWithProviders(
            card({ votes: { total: 1, mine: 1 }, canVote: true, onVote }),
        );
        const article = screen.getByRole('article');

        fireEvent.keyDown(article, { key: 'v' });
        fireEvent.keyDown(article, { key: 'V', shiftKey: true });

        expect(onVote).toHaveBeenNthCalledWith(1, 1);
        expect(onVote).toHaveBeenNthCalledWith(2, -1);
    });

    it('leaves V alone while single-key shortcuts are off, and keeps Enter', () => {
        const onVote = vi.fn();
        const onEditStart = vi.fn();
        renderWithProviders(
            card({
                votes: { total: 1, mine: 1 },
                canVote: true,
                canEdit: true,
                onVote,
                onEditStart,
            }),
        );
        const article = screen.getByRole('article');

        setSingleKeyShortcuts(false);
        fireEvent.keyDown(article, { key: 'v' });
        fireEvent.keyDown(article, { key: 'Enter' });

        expect(onVote).not.toHaveBeenCalled();
        expect(onEditStart).toHaveBeenCalledTimes(1);
    });

    it('does not vote when voting is closed', () => {
        const onVote = vi.fn();
        renderWithProviders(
            card({ votes: { total: 1, mine: 0 }, canVote: false, onVote }),
        );

        const button = screen.getByRole('button', { name: 'Add a vote' });

        fireEvent.keyDown(screen.getByRole('article'), { key: 'v' });
        fireEvent.click(button);

        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(onVote).not.toHaveBeenCalled();
    });

    it('takes a vote back when the budget is spent, by the button and by Shift+V', () => {
        const onVote = vi.fn();
        renderWithProviders(
            card({
                votes: { total: 1, mine: 1 },
                canVote: false,
                canUnvote: true,
                onVote,
            }),
        );

        fireEvent.keyDown(screen.getByRole('article'), { key: 'v' });
        expect(onVote).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Remove a vote' }));
        fireEvent.keyDown(screen.getByRole('article'), {
            key: 'V',
            shiftKey: true,
        });

        expect(onVote.mock.calls).toEqual([[-1], [-1]]);
    });

    it('has no "Remove a vote" where no vote can be taken back', () => {
        const { rerender } = renderWithProviders(
            card({ votes: { total: 1, mine: 1 }, canVote: false }),
        );

        expect(
            screen.queryByRole('button', { name: 'Remove a vote' }),
        ).toBeNull();

        rerender(
            card({
                votes: { total: 1, mine: 0 },
                canVote: true,
                canUnvote: true,
            }),
        );

        expect(
            screen.queryByRole('button', { name: 'Remove a vote' }),
        ).toBeNull();
    });

    it('moves the focus to add when the last vote is taken back from a spent budget', () => {
        const spent = (mine: number) =>
            card({
                votes: { total: mine, mine },
                canVote: false,
                canUnvote: true,
            });
        const { rerender } = renderWithProviders(spent(1));
        const remove = screen.getByRole('button', { name: 'Remove a vote' });

        remove.focus();
        fireEvent.click(remove);
        rerender(spent(0));

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Add a vote' }),
        );
    });

    it('turns add off with its reason when no vote is left', () => {
        const onVote = vi.fn();
        renderWithProviders(
            card({
                votes: { total: 1, mine: 0 },
                canVote: false,
                labels: { voteBlocked: 'You have used all your votes' },
                onVote,
            }),
        );

        const add = screen.getByRole('button', {
            name: 'Add a vote',
            description: 'You have used all your votes',
        }) as HTMLButtonElement;

        fireEvent.click(add);

        expect(add.getAttribute('aria-disabled')).toBe('true');
        expect(add.disabled).toBe(false);
        expect(screen.queryByRole('group')).toBeNull();
        expect(onVote).not.toHaveBeenCalled();
    });

    it("turns add off with its reason when the card's limit is reached", () => {
        const onVote = vi.fn();
        renderWithProviders(
            card({
                votes: { total: 5, mine: 3 },
                canVote: false,
                canUnvote: true,
                labels: {
                    voteBlocked:
                        'You reached the limit of 3 votes on this card',
                },
                onVote,
            }),
        );

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Add a vote',
                description: 'You reached the limit of 3 votes on this card',
            }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Remove a vote' }));

        expect(onVote.mock.calls).toEqual([[-1]]);
    });

    it('keeps the focus on add when the press spends the last vote', () => {
        const spent = (canVote: boolean, voteBlocked?: string) =>
            card({
                votes: { total: 1, mine: canVote ? 0 : 1 },
                canVote,
                labels: { voteBlocked },
            });
        const { rerender } = renderWithProviders(spent(true));
        const add = screen.getByRole('button', { name: 'Add a vote' });

        add.focus();
        rerender(spent(false, 'You have used all your votes'));

        expect(document.activeElement).toBe(add);
        expect(
            screen.getByRole('button', {
                name: 'Add a vote',
                description: 'You have used all your votes',
            }),
        ).toBe(add);
    });

    it('never disables add natively, so the browser leaves its focus where the press was made', () => {
        const spent = (canVote: boolean) =>
            card({ votes: { total: 1, mine: 1 }, canVote, onVote: vi.fn() });
        const { rerender } = renderWithProviders(spent(true));
        const button = screen.getByRole('button', {
            name: 'Add a vote',
        }) as HTMLButtonElement;

        button.focus();
        fireEvent.click(button);
        rerender(spent(false));

        expect(button.disabled).toBe(false);
        expect(document.activeElement).toBe(button);
    });

    it('keeps the focus on add when voting closes without a stated reason', () => {
        const spent = (canVote: boolean) =>
            card({ votes: { total: 1, mine: 1 }, canVote });
        const { rerender } = renderWithProviders(spent(true));
        const add = screen.getByRole('button', { name: 'Add a vote' });

        add.focus();
        rerender(spent(false));

        expect(document.activeElement).toBe(add);
        expect(add.getAttribute('aria-disabled')).toBe('true');
        expect(add.hasAttribute('aria-describedby')).toBe(false);
    });

    it('starts editing on Enter only for editable, unlocked cards', () => {
        const onEditStart = vi.fn();
        const { rerender } = renderWithProviders(card({ onEditStart }));

        fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' });
        expect(onEditStart).not.toHaveBeenCalled();

        rerender(card({ onEditStart, canEdit: true }));
        fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' });
        expect(onEditStart).toHaveBeenCalledTimes(1);

        rerender(
            card({
                onEditStart,
                canEdit: true,
                lockedBy: { name: 'Ines', presence: 9 },
            }),
        );
        fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' });
        expect(onEditStart).toHaveBeenCalledTimes(1);
    });

    it('asks to delete with the Delete key', () => {
        const onDelete = vi.fn();
        renderWithProviders(card({ canEdit: true, onDelete }));

        fireEvent.keyDown(screen.getByRole('article'), { key: 'Delete' });

        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('shows the lock tag with the editor name', () => {
        renderWithProviders(card({ lockedBy: { name: 'Ines', presence: 9 } }));

        expect(screen.getByRole('status').textContent).toContain(
            'Ines is writing',
        );
    });

    describe('editing', () => {
        it('shows the counter and publishes trimmed text on Enter', () => {
            const onEdit = vi.fn();
            renderWithProviders(card({ editing: true, onEdit }));
            const input = screen.getByRole('textbox', { name: 'Card text' });

            expect(screen.getByText('18/280')).toBeTruthy();

            fireEvent.change(input, { target: { value: '  New text ' } });
            fireEvent.keyDown(input, { key: 'Enter' });

            expect(onEdit).toHaveBeenCalledWith('New text');
        });

        it('publishes on Ctrl+Enter, keeps Shift+Enter for new lines', () => {
            const onEdit = vi.fn();
            renderWithProviders(card({ editing: true, onEdit }));
            const input = screen.getByRole('textbox');

            fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
            expect(onEdit).not.toHaveBeenCalled();

            fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
            expect(onEdit).toHaveBeenCalledTimes(1);
        });

        it('does not publish empty text', () => {
            const onEdit = vi.fn();
            renderWithProviders(card({ editing: true, onEdit }));
            const input = screen.getByRole('textbox');

            fireEvent.change(input, { target: { value: '   ' } });
            fireEvent.keyDown(input, { key: 'Enter' });

            expect(onEdit).not.toHaveBeenCalled();
        });

        it('cancels on Escape', () => {
            const onEditCancel = vi.fn();
            renderWithProviders(card({ editing: true, onEditCancel }));

            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

            expect(onEditCancel).toHaveBeenCalledTimes(1);
        });

        it('enforces the max length', () => {
            renderWithProviders(card({ editing: true, maxLength: 20 }));

            expect(screen.getByRole('textbox').getAttribute('maxlength')).toBe(
                '20',
            );
            expect(screen.getByText('18/20')).toBeTruthy();
        });

        it('puts Cancel beside the primary button on one row, the counter at the left', () => {
            renderWithProviders(
                card({
                    editing: true,
                    editorTools: (
                        <>
                            <button type="button">Cancel</button>
                            <button type="button">Save</button>
                        </>
                    ),
                }),
            );
            const footer = screen
                .getByRole('article')
                .querySelector('[data-slot="retro-card-footer"]');
            const [counter, actions, hints] = Array.from(
                footer?.children ?? [],
            ).filter((child) => !child.classList.contains('sr-only'));
            const cancel = screen.getByRole('button', { name: 'Cancel' });

            expect(counter.getAttribute('data-slot')).toBe(
                'retro-card-counter',
            );
            expect(counter.classList.contains('tabular-nums')).toBe(true);
            expect(actions.getAttribute('data-slot')).toBe(
                'retro-card-editor-actions',
            );
            expect(actions.classList.contains('ms-auto')).toBe(true);
            expect(actions.classList.contains('gap-2')).toBe(true);
            expect(cancel.parentElement).toBe(actions);
            expect(cancel.nextElementSibling).toBe(
                screen.getByRole('button', { name: 'Save' }),
            );
            expect(hints.getAttribute('data-slot')).toBe('retro-card-hints');
            expect(hints.classList.contains('basis-full')).toBe(true);
        });

        it("names the Enter key with the button's verb, when adding and when editing", () => {
            const tools = <button type="button">Save</button>;
            const hintsOf = () =>
                screen
                    .getByRole('article')
                    .querySelector('[data-slot="retro-card-hints"]');
            const { rerender } = renderWithProviders(
                card({ editing: true, editorTools: tools }),
            );

            expect(hintsOf()?.textContent).toBe(
                'Enter to save · Shift+Enter for a new line · Esc to cancel',
            );
            expect(hintsOf()?.getAttribute('aria-hidden')).toBe('true');
            expect(hintsOf()?.classList.contains('pointer-coarse:hidden')).toBe(
                true,
            );
            expect(
                screen.getByText(/Shift\+Enter for a new line/).className,
            ).toContain('@md/card:inline');

            rerender(
                card({
                    text: null,
                    editing: true,
                    autoFocusEditor: false,
                    labels: { editor: 'Add a card…' },
                    editorTools: tools,
                }),
            );

            expect(hintsOf()?.textContent).toContain('Enter to save');
            expect(screen.queryByText(/publish/)).toBeNull();
        });

        it('warns from 90 % of the limit and stops at the limit', () => {
            renderWithProviders(
                card({
                    text: '12345678901234567',
                    editing: true,
                    maxLength: 20,
                }),
            );
            const input = screen.getByRole('textbox');
            const counter = screen.getByText('17/20');
            const left = () =>
                screen
                    .getByRole('article')
                    .querySelector('[data-slot="retro-card-left"]');
            const type = (length: number) =>
                fireEvent.change(input, {
                    target: { value: 'x'.repeat(length) },
                });

            expect(counter.classList.contains('text-muted-foreground')).toBe(
                true,
            );
            expect(counter.hasAttribute('aria-live')).toBe(false);
            expect(left()?.getAttribute('aria-live')).toBe('polite');
            expect(left()?.classList.contains('sr-only')).toBe(true);
            expect(left()?.textContent).toBe('');

            type(18);

            expect(counter.textContent).toBe('18/20');
            expect(counter.classList.contains('text-skrum-warning-text')).toBe(
                true,
            );
            expect(left()?.textContent).toBe('2 characters left');

            type(19);

            expect(counter.classList.contains('text-skrum-warning-text')).toBe(
                true,
            );
            expect(left()?.textContent).toBe('2 characters left');

            type(20);

            expect(
                counter.classList.contains('text-skrum-destructive-text'),
            ).toBe(true);
            expect(left()?.textContent).toBe('0 characters left');

            type(19);

            expect(left()?.textContent).toBe('1 character left');

            type(3);

            expect(counter.classList.contains('text-muted-foreground')).toBe(
                true,
            );
            expect(left()?.textContent).toBe('');
        });

        it('blocks publishing when another participant locks the card mid-edit', () => {
            const onEdit = vi.fn();
            const { rerender } = renderWithProviders(
                card({ editing: true, onEdit }),
            );
            const input = screen.getByRole('textbox');

            fireEvent.change(input, { target: { value: 'My draft' } });
            rerender(
                card({
                    editing: true,
                    onEdit,
                    lockedBy: { name: 'Ines', presence: 9 },
                }),
            );
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

            const locked = screen.getByRole('textbox') as HTMLTextAreaElement;
            expect(locked.readOnly).toBe(true);
            expect(locked.value).toBe('My draft');
            expect(onEdit).not.toHaveBeenCalled();

            rerender(card({ editing: true, onEdit }));
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

            expect(onEdit).toHaveBeenCalledWith('My draft');
        });
    });

    describe('reactions', () => {
        it('toggles an existing reaction and adds one from the picker', () => {
            const onReact = vi.fn();
            renderWithProviders(
                card({
                    onReact,
                    reactions: [{ emoji: '🎉', count: 4, mine: true }],
                }),
            );

            const mine = screen.getByRole('button', {
                name: '🎉, 4 reactions',
            });
            expect(mine.getAttribute('aria-pressed')).toBe('true');
            fireEvent.click(mine);
            expect(onReact).toHaveBeenCalledWith('🎉');

            fireEvent.click(
                screen.getByRole('button', { name: 'Add a reaction' }),
            );
            fireEvent.click(
                screen.getByRole('button', { name: 'React with 💡' }),
            );
            expect(onReact).toHaveBeenLastCalledWith('💡');
        });

        it('names a chip in the singular and in the plural', () => {
            renderWithProviders(
                card({
                    onReact: vi.fn(),
                    reactions: [
                        { emoji: '👍', count: 1, mine: false },
                        { emoji: '🎉', count: 2, mine: false },
                    ],
                }),
            );

            expect(
                screen.getByRole('button', { name: '👍, 1 reaction' }),
            ).toBeTruthy();
            expect(
                screen.getByRole('button', { name: '🎉, 2 reactions' }),
            ).toBeTruthy();
        });

        it('disables the chips of a card nobody may react to, and keeps the names reachable', async () => {
            renderWithProviders(
                card({
                    reactions: [
                        {
                            emoji: '👍',
                            count: 1,
                            mine: false,
                            names: ['Alice'],
                        },
                        { emoji: '🎉', count: 1, mine: false },
                    ],
                }),
            );

            const chip = screen.getByRole('button', {
                name: '👍, 1 reaction',
            }) as HTMLButtonElement;
            const reader = chip.closest(
                '[data-slot="retro-card-reaction-reader"]',
            ) as HTMLElement;

            expect(chip.disabled).toBe(true);
            expect(reader.tabIndex).toBe(0);
            expect(
                screen
                    .getByRole('button', { name: '🎉, 1 reaction' })
                    .closest('[data-slot="retro-card-reaction-reader"]'),
            ).toBeNull();

            fireEvent.focus(reader);

            expect(
                (await screen.findAllByText('Alice')).length,
            ).toBeGreaterThan(0);
        });

        it('leaves the chips enabled, without a wrapper, when reacting is allowed', () => {
            renderWithProviders(
                card({
                    onReact: vi.fn(),
                    reactions: [
                        {
                            emoji: '👍',
                            count: 1,
                            mine: false,
                            names: ['Alice'],
                        },
                    ],
                }),
            );

            const chip = screen.getByRole('button', {
                name: '👍, 1 reaction',
            }) as HTMLButtonElement;

            expect(chip.disabled).toBe(false);
            expect(
                chip.closest('[data-slot="retro-card-reaction-reader"]'),
            ).toBeNull();
        });

        it('names who reacted in a tooltip', async () => {
            renderWithProviders(
                card({
                    reactions: [
                        {
                            emoji: '👍',
                            count: 2,
                            mine: false,
                            names: ['Alice', 'Bob'],
                        },
                    ],
                }),
            );

            fireEvent.focus(
                screen.getByRole('button', { name: '👍, 2 reactions' }),
            );

            expect(
                (await screen.findAllByText('Alice, Bob')).length,
            ).toBeGreaterThan(0);
        });

        it('hands the add control to the host picker', () => {
            const onOpenReactionPicker = vi.fn();
            const { rerender } = renderWithProviders(
                card({ onReact: vi.fn(), onOpenReactionPicker }),
            );

            fireEvent.click(
                screen.getByRole('button', { name: 'Add a reaction' }),
            );

            expect(onOpenReactionPicker).toHaveBeenCalledOnce();
            expect(
                screen.queryByRole('button', { name: 'React with 💡' }),
            ).toBeNull();

            rerender(
                card({
                    onReact: vi.fn(),
                    reactionPicker: <button>Full picker</button>,
                }),
            );

            expect(
                screen.getByRole('button', { name: 'Full picker' }),
            ).toBeTruthy();
            expect(
                screen.queryByRole('button', { name: 'Add a reaction' }),
            ).toBeNull();
        });

        it('hides the add control without onReact', () => {
            renderWithProviders(card());

            expect(
                screen.queryByRole('button', { name: 'Add a reaction' }),
            ).toBeNull();
        });
    });

    it('hides a ghost card from assistive tech', () => {
        const { container } = renderWithProviders(card({ ghost: true }));

        expect(
            container.querySelector('[data-ghost][aria-hidden="true"]'),
        ).not.toBeNull();
    });

    it('flags dragging, selected and focused states', () => {
        const { container } = renderWithProviders(
            card({ dragging: true, selected: true, focused: true }),
        );
        const article = container.querySelector('article');

        expect(article?.dataset.dragging).toBe('true');
        expect(article?.dataset.selected).toBe('true');
        expect(screen.getByText('Everyone is looking here')).toBeTruthy();
    });

    describe('back-end card shape', () => {
        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('renders a GIF card without text and opens the GIF', () => {
            const onGifOpen = vi.fn();
            const { container } = renderWithProviders(
                card({
                    text: null,
                    gif: { previewUrl: '/preview.gif', url: '/full.gif' },
                    onGifOpen,
                }),
            );

            expect(
                screen.getByRole('article', { name: 'GIF, Camille Roux' }),
            ).toBeTruthy();
            expect(
                container.querySelector('[data-slot="retro-card-text"]'),
            ).toBeNull();
            expect(
                container
                    .querySelector('[data-slot="retro-card-gif"] img')
                    ?.getAttribute('src'),
            ).toBe('/preview.gif');

            fireEvent.click(screen.getByRole('button', { name: 'GIF' }));

            expect(onGifOpen).toHaveBeenCalledTimes(1);
        });

        it('shows the GIF as an image when it cannot be opened', () => {
            renderWithProviders(
                card({ gif: { previewUrl: '/preview.gif', url: '/full.gif' } }),
            );

            expect(screen.getByRole('img', { name: 'GIF' })).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'GIF' })).toBeNull();
        });

        it('publishes an empty text only when the card keeps a GIF', () => {
            const onEdit = vi.fn();
            const { rerender } = renderWithProviders(
                card({ editing: true, onEdit }),
            );

            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: ' ' },
            });
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
            expect(onEdit).not.toHaveBeenCalled();

            rerender(
                card({
                    editing: true,
                    onEdit,
                    gif: { previewUrl: '/preview.gif', url: '/full.gif' },
                }),
            );
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

            expect(onEdit).toHaveBeenCalledWith('');
        });

        it('uses the avatar URL of the author as image source', async () => {
            class LoadedImage extends EventTarget {
                complete = true;
                naturalWidth = 1;
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                referrerPolicy = '';
                crossOrigin: string | null = null;

                set src(_value: string) {
                    setTimeout(() => {
                        this.onload?.();
                        this.dispatchEvent(new Event('load'));
                    }, 0);
                }
            }

            vi.stubGlobal('Image', LoadedImage);

            const { container } = renderWithProviders(
                card({
                    author: { ...author, avatarUrl: '/avatars/camille.png' },
                }),
            );

            await vi.waitFor(() =>
                expect(
                    container
                        .querySelector('[data-slot="avatar-image"]')
                        ?.getAttribute('src'),
                ).toBe('/avatars/camille.png'),
            );
        });

        it('takes the column colour as its colour context', () => {
            const { rerender } = renderWithProviders(card({ color: 'moss' }));

            expect(
                screen.getByRole('article').classList.contains('col-moss'),
            ).toBe(true);

            rerender(card({ color: 'iris' }));

            expect(
                screen.getByRole('article').classList.contains('col-iris'),
            ).toBe(true);
        });

        it('marks my own card with the You badge', () => {
            const { rerender } = renderWithProviders(card());

            expect(screen.queryByText('You')).toBeNull();

            rerender(card({ isMine: true }));

            expect(screen.getByText('You')).toBeTruthy();
        });

        it('shows the insight of a card', () => {
            renderWithProviders(
                card({
                    insight: { sentiment: 'positive', category: 'Delivery' },
                }),
            );

            expect(screen.getByRole('img', { name: 'Positive' })).toBeTruthy();
            expect(screen.getByText('Delivery')).toBeTruthy();
        });

        it('opens the comments from the counter', () => {
            const onOpenComments = vi.fn();

            renderWithProviders(
                card({ commentCount: 3, commentsOpen: false, onOpenComments }),
            );
            const trigger = screen.getByRole('button', {
                name: 'Comments (3)',
            });

            expect(trigger.getAttribute('aria-expanded')).toBe('false');

            fireEvent.click(trigger);

            expect(onOpenComments).toHaveBeenCalledTimes(1);
        });

        it('shows a read-only comment count without a callback', () => {
            const { rerender } = renderWithProviders(card({ commentCount: 4 }));

            expect(
                screen.getByRole('img', { name: 'Comments (4)' }),
            ).toBeTruthy();

            rerender(card({ commentCount: 0 }));

            expect(screen.queryByRole('img', { name: /Comments/ })).toBeNull();
        });

        it('toggles the discussion highlight for the facilitator', () => {
            const onFocusToggle = vi.fn();
            const { rerender } = renderWithProviders(card({ onFocusToggle }));
            const discuss = screen.getByRole('button', { name: 'Discuss' });

            expect(discuss.getAttribute('aria-pressed')).toBe('false');

            fireEvent.click(discuss);
            expect(onFocusToggle).toHaveBeenCalledTimes(1);

            rerender(card({ onFocusToggle, focused: true }));

            expect(
                screen
                    .getByRole('button', { name: 'Discuss' })
                    .getAttribute('aria-pressed'),
            ).toBe('true');
        });

        it('offers edit and delete buttons to pointer and touch users', () => {
            const onEditStart = vi.fn();
            const onDelete = vi.fn();
            const { rerender } = renderWithProviders(
                card({ canEdit: true, onEditStart, onDelete }),
            );

            fireEvent.click(screen.getByRole('button', { name: 'Edit card' }));
            fireEvent.click(
                screen.getByRole('button', { name: 'Delete card' }),
            );

            expect(onEditStart).toHaveBeenCalledTimes(1);
            expect(onDelete).toHaveBeenCalledTimes(1);

            rerender(card({ canEdit: false, onEditStart, onDelete }));

            expect(
                screen.queryByRole('button', { name: 'Edit card' }),
            ).toBeNull();
            expect(
                screen.queryByRole('button', { name: 'Delete card' }),
            ).toBeNull();
        });

        describe('footer', () => {
            const slot = (name: string) =>
                screen
                    .getByRole('article')
                    .querySelector<HTMLElement>(`[data-slot="${name}"]`);
            const full = () =>
                card({
                    isMine: true,
                    canEdit: true,
                    onEditStart: vi.fn(),
                    onDelete: vi.fn(),
                    onOpenComments: vi.fn(),
                    commentCount: 2,
                    votes: { total: 3, mine: 2 },
                    canVote: true,
                    menuEntries: [
                        {
                            type: 'item',
                            label: 'Add to group…',
                            onSelect: vi.fn(),
                        },
                    ],
                    footer: <span data-slot="host-control" />,
                });

            it('keeps the controls in one group at the end of the footer, in the same order', () => {
                renderWithProviders(full());
                const footer = slot('retro-card-footer');
                const controls = slot('retro-card-controls');
                const tools = slot('retro-card-tools');

                expect(footer?.classList.contains('justify-between')).toBe(
                    true,
                );
                expect(footer?.firstElementChild).toBe(
                    slot('retro-card-byline'),
                );
                expect(footer?.lastElementChild).toBe(controls);
                expect(controls?.classList.contains('ms-auto')).toBe(true);
                expect(footer?.querySelector('.grow')).toBeNull();
                expect(
                    Array.from(tools?.children ?? []).map((control) =>
                        control.getAttribute('data-slot'),
                    ),
                ).toEqual([
                    'host-control',
                    'retro-card-comments',
                    'retro-card-edit',
                    'retro-card-delete',
                    'retro-card-menu',
                ]);
                expect(tools?.classList.contains('gap-0.5')).toBe(true);
            });

            it('renders nothing for a control the viewer does not have', () => {
                renderWithProviders(card());

                expect(slot('retro-card-tools')?.children).toHaveLength(0);
                expect(
                    slot('retro-card-tools')?.classList.contains(
                        'empty:hidden',
                    ),
                ).toBe(true);
                expect(slot('retro-card-vote-unit')).toBeNull();
                expect(
                    slot('retro-card-footer')?.querySelector('.grow'),
                ).toBeNull();
                expect(screen.queryByRole('button')).toBeNull();
            });

            it("shows edit and delete on one's own card without hover", () => {
                renderWithProviders(full());

                const tones = {
                    'Edit card': 'text-foreground',
                    'Delete card': 'text-skrum-destructive-text',
                };

                for (const [name, tone] of Object.entries(tones)) {
                    const button = screen.getByRole('button', { name });

                    expect(button.className).not.toMatch(
                        /opacity-0|invisible|group-hover|group-focus-within/,
                    );
                    expect(
                        button.classList.contains('text-muted-foreground'),
                    ).toBe(true);
                    expect(button.classList.contains(`hover:${tone}`)).toBe(
                        true,
                    );
                    expect(
                        button.classList.contains(`focus-visible:${tone}`),
                    ).toBe(true);
                }
            });

            it("shows neither on someone else's card", () => {
                renderWithProviders(
                    card({ onOpenComments: vi.fn(), commentCount: 0 }),
                );

                expect(slot('retro-card-edit')).toBeNull();
                expect(slot('retro-card-delete')).toBeNull();
                expect(
                    Array.from(slot('retro-card-tools')?.children ?? []).map(
                        (control) => control.getAttribute('data-slot'),
                    ),
                ).toEqual(['retro-card-comments']);
            });

            it('keeps Edit and Delete as small icon buttons, closer and with a smaller icon', () => {
                renderWithProviders(full());
                const edit = screen.getByRole('button', { name: 'Edit card' });
                const remove = screen.getByRole('button', {
                    name: 'Delete card',
                });

                for (const button of [edit, remove]) {
                    expect(button.classList.contains('size-8')).toBe(true);
                    expect(
                        button.classList.contains('focus-visible:ring-2'),
                    ).toBe(true);
                    expect(
                        button
                            .querySelector('svg')
                            ?.classList.contains('size-3.5'),
                    ).toBe(true);
                }

                expect(edit.nextElementSibling).toBe(remove);
            });

            it('keeps the controls block from breaking', () => {
                renderWithProviders(full());

                expect(
                    slot('retro-card-footer')?.classList.contains('flex-wrap'),
                ).toBe(true);
                expect(
                    slot('retro-card-byline')?.classList.contains('min-w-0'),
                ).toBe(true);

                for (const name of [
                    'retro-card-tools',
                    'retro-card-vote-unit',
                ]) {
                    expect(slot(name)?.classList.contains('flex-nowrap')).toBe(
                        true,
                    );
                    expect(slot(name)?.classList.contains('shrink-0')).toBe(
                        true,
                    );
                }
            });

            it('keeps the total, the take-back, my votes and the vote button in one unit that does not break', () => {
                renderWithProviders(full());
                const unit = slot('retro-card-vote-unit');

                expect(unit?.classList.contains('inline-flex')).toBe(true);
                expect(unit?.classList.contains('flex-nowrap')).toBe(true);
                expect(unit?.classList.contains('shrink-0')).toBe(true);
                expect(unit?.contains(slot('vote-total'))).toBe(true);
                expect(unit?.contains(slot('my-votes'))).toBe(true);
                expect(
                    slot('vote-stepper')?.classList.contains('shrink-0'),
                ).toBe(true);
                expect(
                    unit?.contains(
                        screen.getByRole('button', { name: 'Remove a vote' }),
                    ),
                ).toBe(true);
                expect(
                    unit?.contains(
                        screen.getByRole('button', { name: 'Add a vote' }),
                    ),
                ).toBe(true);
                expect(
                    unit?.querySelectorAll('[data-slot="vote-dot"]'),
                ).toHaveLength(1);
            });

            it('puts the vote unit last in the controls', () => {
                renderWithProviders(full());
                const controls = slot('retro-card-controls');

                expect(controls?.classList.contains('flex-wrap')).toBe(true);
                expect(controls?.classList.contains('justify-end')).toBe(true);
                expect(
                    Array.from(controls?.children ?? []).map((group) =>
                        group.getAttribute('data-slot'),
                    ),
                ).toEqual(['retro-card-tools', 'retro-card-vote-unit']);
            });

            it('keeps the controls of a masked card in the same group', () => {
                renderWithProviders(
                    card({
                        masked: true,
                        isMine: true,
                        footer: <span data-slot="host-control" />,
                    }),
                );

                expect(
                    slot('retro-card-byline')?.contains(
                        slot('retro-card-mask-note'),
                    ),
                ).toBe(true);
                expect(
                    slot('retro-card-tools')?.contains(slot('host-control')),
                ).toBe(true);
            });
        });

        it('renders the generic menu entries', async () => {
            const onSelect = vi.fn();

            renderWithProviders(
                card({
                    menuEntries: [
                        { type: 'item', label: 'Create an action', onSelect },
                    ],
                }),
            );

            fireEvent.pointerDown(
                screen.getByRole('button', { name: 'Card options' }),
                { button: 0, ctrlKey: false },
            );
            fireEvent.click(
                await screen.findByRole('menuitem', {
                    name: 'Create an action',
                }),
            );

            expect(onSelect).toHaveBeenCalledTimes(1);
        });

        it('renders the footer slot and the children', () => {
            renderWithProviders(
                card({
                    footer: <button type="button">Ungroup</button>,
                    children: <div>Comment thread</div>,
                }),
            );

            expect(
                screen
                    .getByRole('button', { name: 'Ungroup' })
                    .closest('[data-slot="retro-card-footer"]'),
            ).not.toBeNull();
            expect(screen.getByText('Comment thread')).toBeTruthy();
        });

        it('forwards the ref, rest props and key handler dnd-kit needs', () => {
            const ref = createRef<HTMLElement>();
            const onKeyDown = vi.fn();
            const onVote = vi.fn();

            renderWithProviders(
                card({
                    ref,
                    onKeyDown,
                    onVote,
                    canVote: true,
                    votes: { total: 0, mine: 0 },
                    style: { opacity: 0.5 },
                    'aria-roledescription': 'sortable',
                    'data-test': 'retro-card-c1',
                } as Partial<RetroCardProps>),
            );
            const article = screen.getByRole('article');

            expect(ref.current).toBe(article);
            expect(article.getAttribute('data-test')).toBe('retro-card-c1');
            expect(article.getAttribute('aria-roledescription')).toBe(
                'sortable',
            );
            expect(article.style.opacity).toBe('0.5');

            fireEvent.keyDown(article, { key: 'v' });

            expect(onKeyDown).toHaveBeenCalledTimes(1);
            expect(onVote).toHaveBeenCalledWith(1);
        });
    });

    describe('focus', () => {
        it('returns to the card when the inline editor closes', () => {
            const { rerender } = renderWithProviders(
                card({ editing: true, canEdit: true }),
            );

            expect(document.activeElement).toBe(screen.getByRole('textbox'));

            rerender(card({ editing: false, canEdit: true }));

            expect(document.activeElement).toBe(screen.getByRole('article'));
        });

        it('does not take focus when the editor closes while focus is elsewhere', () => {
            const { rerender } = renderWithProviders(
                <>
                    <button type="button">Elsewhere</button>
                    {card({ editing: true })}
                </>,
            );
            const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });

            elsewhere.focus();
            rerender(
                <>
                    <button type="button">Elsewhere</button>
                    {card({ editing: false })}
                </>,
            );

            expect(document.activeElement).toBe(elsewhere);
        });

        it('stays on the reaction opener after a quick reaction is picked', () => {
            renderWithProviders(card({ onReact: vi.fn() }));
            const opener = screen.getByRole('button', {
                name: 'Add a reaction',
            });

            fireEvent.click(opener);
            const quick = screen.getByRole('button', { name: 'React with 💡' });

            quick.focus();
            fireEvent.click(quick);

            expect(
                screen.queryByRole('button', { name: 'React with 💡' }),
            ).toBeNull();
            expect(document.activeElement).toBe(opener);
        });
    });

    describe('extreme data', () => {
        it('renders a 280-character card in full', () => {
            const text = 'word '.repeat(56).slice(0, 280);

            renderWithProviders(card({ text }));

            expect(text).toHaveLength(280);
            expect(
                document.querySelector('[data-slot="retro-card-text"]')
                    ?.textContent,
            ).toBe(text);
        });

        it('keeps a 60-character author name on one truncated line', () => {
            const name =
                'Maximilienne-Alexandrine de la Rochefoucauld-Montmorency III';

            renderWithProviders(card({ author: { id: 'long', name } }));
            const authorSlot = document.querySelector(
                '[data-slot="retro-card-author"]',
            );

            expect(name).toHaveLength(60);
            expect(authorSlot?.getAttribute('title')).toBe(name);
            expect(authorSlot?.querySelector('.truncate')?.textContent).toBe(
                'Maximilienne-Alexandrine',
            );
        });
    });
});

describe('RetroCard votes on a phone', () => {
    it('gives the vote and its take-back a 44px target below md', () => {
        const votes = (mine: number) => (
            <RetroCard
                id="c1"
                text="Slow CI"
                color="moss"
                votes={{ total: 2, mine }}
                canVote
                onVote={() => {}}
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
