import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckPicker, deckCards } from '@/components/skrum/deck-picker';
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

    it('shows only the first seven cards and a +n counter, hidden from assistive tech', () => {
        renderPicker();

        const option = screen.getByRole('radio', {
            name: 'Fibonacci, 13 cards',
        });
        const values = option.querySelector('[data-slot="deck-values"]');

        expect(values?.getAttribute('aria-hidden')).toBe('true');
        expect(values?.textContent).toContain('+6');
    });

    it('marks built-in and saved decks and shows the author', () => {
        renderPicker();

        expect(screen.getAllByText('Built-in')).toHaveLength(2);
        expect(screen.getByText('Saved')).toBeTruthy();
        expect(screen.getByText('Ada')).toBeTruthy();
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

    it('offers edit on saved decks only and only when onEdit is given', () => {
        const { onValueChange } = renderPicker();

        expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
        expect(onValueChange).not.toHaveBeenCalled();
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
});
