import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    DeckPicker,
    deckCards,
    deckShapeFromCards,
} from '@/components/skrum/deck-picker';
import type { Deck } from '@/components/skrum/deck-picker';
import { renderWithProviders } from '@/test/render';

const decks: Deck[] = [
    {
        id: 'fibonacci',
        name: 'Fibonacci',
        values: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89'],
        unknownCard: true,
        breakCard: true,
        source: 'builtin',
    },
    {
        id: 'tshirt',
        name: 'T-shirt',
        values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        unknownCard: true,
        breakCard: false,
        source: 'builtin',
    },
    {
        id: 'mine',
        name: 'Team sizes',
        values: ['1', '2', '3'],
        unknownCard: false,
        breakCard: false,
        source: 'saved',
        canManage: true,
        createdBy: { name: 'Ada' },
    },
];

function renderPicker(props: Partial<Parameters<typeof DeckPicker>[0]> = {}) {
    const onValueChange = vi.fn();
    const onCreate = vi.fn();

    renderWithProviders(
        <DeckPicker
            value="tshirt"
            onValueChange={onValueChange}
            decks={decks}
            onCreate={onCreate}
            {...props}
        />,
    );

    return { onValueChange, onCreate };
}

describe('DeckPicker', () => {
    it('counts cards including the enabled special cards', () => {
        expect(deckCards(decks[0])).toHaveLength(13);
        expect(deckCards(decks[1])).toHaveLength(7);
        expect(deckCards(decks[2])).toHaveLength(3);
    });

    it('exposes a radiogroup whose radios are named with deck and card count', () => {
        renderPicker();

        expect(screen.getByRole('radiogroup')).toBeTruthy();
        expect(
            screen.getByRole('radio', { name: 'Fibonacci, 13 cards' }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('radio', { name: 'T-shirt, 7 cards' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('selects a deck on click', () => {
        const { onValueChange } = renderPicker();

        fireEvent.click(
            screen.getByRole('radio', { name: 'Team sizes, 3 cards' }),
        );

        expect(onValueChange).toHaveBeenCalledWith('mine');
    });

    it('shows the first seven values, a +n counter for the other values and the special cards, hidden from assistive tech', () => {
        renderPicker();

        const option = screen.getByRole('radio', {
            name: 'Fibonacci, 13 cards',
        });
        const values = option.querySelector('[data-slot="deck-values"]');

        expect(values?.getAttribute('aria-hidden')).toBe('true');
        expect(values?.textContent).toBe('01235813+4?☕');
    });

    it('marks built-in and saved decks and shows the author', () => {
        renderPicker();

        expect(screen.getAllByText('Built-in')).toHaveLength(2);
        expect(screen.getByText('Saved')).toBeTruthy();
        expect(screen.getByText('by Ada')).toBeTruthy();
    });

    it('marks a deck typed for one game and a deck of the workspace', () => {
        const onEdit = vi.fn();

        renderPicker({
            onEdit,
            onDelete: vi.fn(),
            decks: [
                ...decks.slice(0, 2),
                {
                    id: 'shared',
                    name: 'Hours',
                    values: ['1', '2', '4'],
                    unknownCard: false,
                    breakCard: false,
                    source: 'saved',
                    scope: 'workspace',
                },
                {
                    id: 'custom',
                    name: 'Custom deck',
                    values: ['1', '2'],
                    unknownCard: true,
                    breakCard: false,
                    source: 'custom',
                    canManage: true,
                },
            ],
        });

        const shared = screen.getByRole('radio', { name: 'Hours, 3 cards' });
        const custom = screen.getByRole('radio', {
            name: 'Custom deck, 3 cards',
        });

        expect(within(shared).getByText('Workspace')).toBeTruthy();
        expect(within(shared).queryByText('Saved')).toBeNull();
        expect(within(custom).getByText('This game only')).toBeTruthy();

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit Custom deck' }),
        );

        expect(onEdit).toHaveBeenCalledWith('custom');
        expect(screen.queryByRole('button', { name: 'Edit Hours' })).toBeNull();
    });

    it('lists every value of the selected deck, specials with their label', () => {
        renderPicker();

        const group = screen.getByRole('group', {
            name: 'T-shirt, 7 cards: XS, S, M, L, XL, XXL, ?',
        });

        expect(within(group).getByText("I don't know")).toBeTruthy();
    });

    it('calls onCreate from the dashed card', () => {
        const { onCreate } = renderPicker();

        fireEvent.click(screen.getByRole('button', { name: 'Create a deck' }));

        expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it('describes the dashed card with the values and the optional special cards', () => {
        renderPicker();

        expect(
            screen
                .getByRole('button', { name: 'Create a deck' })
                .getAttribute('aria-describedby'),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', {
                description: 'Your values, ? and ☕ optional.',
            }),
        ).toBeTruthy();
    });

    it('offers no edit or delete without the callbacks', () => {
        renderPicker();

        expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
    });

    it('calls onEdit with the saved deck id without selecting it', () => {
        const onEdit = vi.fn();
        const { onValueChange } = renderPicker({ onEdit });

        expect(screen.getAllByRole('button', { name: /^Edit/ })).toHaveLength(
            1,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit Team sizes' }),
        );

        expect(onEdit).toHaveBeenCalledWith('mine');
        expect(onValueChange).not.toHaveBeenCalled();
    });

    it('hides edit and delete on a saved deck the user cannot manage', () => {
        renderPicker({
            onEdit: vi.fn(),
            onDelete: vi.fn(),
            decks: [
                ...decks.slice(0, 2),
                { ...decks[2], canManage: false },
                {
                    ...decks[2],
                    id: 'legacy',
                    name: 'Legacy',
                    canManage: undefined,
                },
            ],
        });

        expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
    });

    it('deletes a saved deck only after confirmation, then moves focus to the create card', async () => {
        const onDelete = vi.fn();
        const onValueChange = vi.fn();
        const { rerender } = renderWithProviders(
            <DeckPicker
                value="tshirt"
                onValueChange={onValueChange}
                decks={decks}
                onCreate={vi.fn()}
                onDelete={onDelete}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete Team sizes' }),
        );

        const dialog = screen.getByRole('alertdialog');

        expect(onDelete).not.toHaveBeenCalled();
        expect(within(dialog).getByText('Delete this deck?')).toBeTruthy();

        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Delete deck' }),
        );

        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
        expect(onDelete).toHaveBeenCalledWith('mine');
        expect(onValueChange).not.toHaveBeenCalled();

        rerender(
            <DeckPicker
                value="tshirt"
                onValueChange={onValueChange}
                decks={decks.slice(0, 2)}
                onCreate={vi.fn()}
                onDelete={onDelete}
            />,
        );

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Create a deck' }),
        );
    });

    it('warns that deleting a workspace deck removes it for every team', () => {
        renderPicker({
            onDelete: vi.fn(),
            decks: [{ ...decks[2], scope: 'workspace' }],
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete Team sizes' }),
        );

        expect(
            within(screen.getByRole('alertdialog')).getByText(
                'The saved deck “Team sizes” is removed for every team of the workspace.',
            ),
        ).toBeTruthy();
    });

    it('tells assistive tech where each deck comes from and who made it', () => {
        renderPicker();

        expect(
            screen.getByRole('radio', {
                name: 'Team sizes, 3 cards',
                description: /Saved\s*by Ada/,
            }),
        ).toBeTruthy();
        expect(
            screen.getByRole('radio', {
                name: 'Fibonacci, 13 cards',
                description: 'Built-in',
            }),
        ).toBeTruthy();
    });

    it('keeps the deck when the confirmation is cancelled', () => {
        const onDelete = vi.fn();
        renderPicker({ onDelete });

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete Team sizes' }),
        );
        fireEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Cancel',
            }),
        );

        expect(onDelete).not.toHaveBeenCalled();
    });

    it('splits the server card list into values and special cards', () => {
        expect(deckShapeFromCards(['1', '2', '?', '☕'])).toEqual({
            values: ['1', '2'],
            unknownCard: true,
            breakCard: true,
        });
        expect(deckShapeFromCards(['S', 'M'])).toEqual({
            values: ['S', 'M'],
            unknownCard: false,
            breakCard: false,
        });
    });

    it('renders no deck, and a deck of 20 values of 8 characters with a 40-character name', () => {
        const { unmount } = renderWithProviders(
            <DeckPicker
                value=""
                onValueChange={vi.fn()}
                decks={[]}
                onCreate={vi.fn()}
            />,
        );

        expect(screen.queryByRole('radio')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Create a deck' }),
        ).toBeTruthy();
        unmount();

        const name = 'D'.repeat(40);
        const values = Array.from({ length: 20 }, (_, i) =>
            `${i}-abcdefg`.slice(0, 8),
        );

        renderPicker({
            value: 'big',
            decks: [
                {
                    id: 'big',
                    name,
                    values,
                    unknownCard: true,
                    breakCard: true,
                    source: 'saved',
                },
            ],
        });

        const option = screen.getByRole('radio', {
            name: `${name}, 22 cards`,
        });

        expect(
            option.querySelector('[data-slot="deck-values"]')?.textContent,
        ).toContain('+13');
        expect(
            screen
                .getByRole('group', { name: new RegExp(`^${name}, 22 cards:`) })
                .querySelectorAll('[data-slot="deck-preview-card"]'),
        ).toHaveLength(22);
    });
});

describe('DeckPicker, compact variant', () => {
    it('heads the section with its title and a "New deck" button, without the dashed card', () => {
        const { onCreate } = renderPicker({ variant: 'compact' });

        expect(
            document
                .querySelector('[data-slot="deck-picker"]')
                ?.getAttribute('data-variant'),
        ).toBe('compact');
        expect(
            screen.queryByRole('button', { name: 'Create a deck' }),
        ).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'New deck' }));

        expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it('shows on each tile the name, every value in mono and where the deck comes from', () => {
        renderPicker({ variant: 'compact' });

        const tile = screen.getByRole('radio', { name: 'Fibonacci, 13 cards' });
        const values = tile.querySelector('[data-slot="deck-values"]');

        expect(within(tile).getByText('Fibonacci')).toBeTruthy();
        expect(values?.textContent).toBe('0 1 2 3 5 8 13 21 34 55 89 ? ☕');
        expect(values?.className).toContain('font-mono');
        expect(values?.getAttribute('aria-hidden')).toBe('true');
        expect(within(tile).getByText('Built-in')).toBeTruthy();
        expect(
            within(
                screen.getByRole('radio', { name: 'Team sizes, 3 cards' }),
            ).getByText('Saved'),
        ).toBeTruthy();
    });

    it('tells assistive tech where each compact tile comes from', () => {
        renderPicker({ variant: 'compact' });

        expect(
            screen.getByRole('radio', {
                name: 'Team sizes, 3 cards',
                description: 'Saved',
            }),
        ).toBeTruthy();
    });

    it('selects a tile on click and lists the values of the selected deck', () => {
        const { onValueChange } = renderPicker({ variant: 'compact' });

        fireEvent.click(
            screen.getByRole('radio', { name: 'Fibonacci, 13 cards' }),
        );

        expect(onValueChange).toHaveBeenCalledWith('fibonacci');
        expect(
            screen
                .getByRole('group', {
                    name: 'T-shirt, 7 cards: XS, S, M, L, XL, XXL, ?',
                })
                .querySelectorAll('[data-slot="deck-preview-card"]'),
        ).toHaveLength(7);
    });

    it('offers edit and delete for the selected deck only, when the user can manage it', () => {
        const onEdit = vi.fn();
        const { rerender } = renderWithProviders(
            <DeckPicker
                variant="compact"
                value="tshirt"
                onValueChange={vi.fn()}
                decks={decks}
                onCreate={vi.fn()}
                onEdit={onEdit}
                onDelete={vi.fn()}
            />,
        );

        expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();

        rerender(
            <DeckPicker
                variant="compact"
                value="mine"
                onValueChange={vi.fn()}
                decks={decks}
                onCreate={vi.fn()}
                onEdit={onEdit}
                onDelete={vi.fn()}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit Team sizes' }),
        );

        expect(onEdit).toHaveBeenCalledWith('mine');
        expect(
            screen.getByRole('button', { name: 'Delete Team sizes' }),
        ).toBeTruthy();
    });
});
