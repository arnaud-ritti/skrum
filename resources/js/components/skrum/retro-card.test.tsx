import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RetroCard } from '@/components/skrum/retro-card';
import type { RetroCardProps } from '@/components/skrum/retro-card';
import { renderWithProviders } from '@/test/render';

const author = {
    id: 'u1',
    name: 'Camille Roux',
    initials: 'CR',
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
    it('labels the article with text, author and votes', () => {
        renderWithProviders(card({ votes: { total: 3, mine: 0 } }));

        expect(
            screen.getByRole('article', {
                name: 'The demo went well, Camille Roux, 3 votes',
            }),
        ).toBeTruthy();
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

    it('hides the vote total when null and shows my votes', () => {
        renderWithProviders(
            card({ votes: { total: null, mine: 2 }, canVote: true }),
        );

        expect(screen.getByRole('button', { name: 'Vote' })).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Your votes: 2' })).toBeTruthy();
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

    it('does not vote when voting is closed', () => {
        const onVote = vi.fn();
        renderWithProviders(
            card({ votes: { total: 1, mine: 0 }, canVote: false, onVote }),
        );

        fireEvent.keyDown(screen.getByRole('article'), { key: 'v' });
        fireEvent.click(screen.getByRole('button', { name: /Vote/ }));

        expect(onVote).not.toHaveBeenCalled();
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

            expect(screen.getByText('18/1000')).toBeTruthy();

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
});
