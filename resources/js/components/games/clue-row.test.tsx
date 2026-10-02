import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClueRow } from './clue-row';
import { WordMask } from './word-mask';

describe('ClueRow', () => {
    it('names the clue and shows five slots, the given emoji first', () => {
        render(<ClueRow clue={['🚀', '🌕']} />);

        const row = screen.getByRole('img', { name: 'Clue: 🚀 🌕' });
        const slots = [...row.children];

        expect(slots).toHaveLength(5);
        expect(slots.map((slot) => slot.textContent)).toEqual([
            '🚀',
            '🌕',
            '',
            '',
            '',
        ]);
        expect(row.querySelectorAll('[data-filled]')).toHaveLength(2);
    });

    it('says so when no clue was given yet', () => {
        render(<ClueRow clue={[]} size="lg" />);

        expect(
            screen.getByRole('img', { name: 'No clue yet' }).children,
        ).toHaveLength(5);
    });
});

describe('WordMask', () => {
    it('marks the letters a hint gave away, and only when asked to', () => {
        const mask = [null, 'a', null, ' ', 'c', null];
        const { rerender } = render(<WordMask mask={mask} hint />);
        const word = screen.getByRole('img', {
            name: '3 letters left to find',
        });

        expect(
            [...word.querySelectorAll('[data-hint]')].map(
                (cell) => cell.textContent,
            ),
        ).toEqual(['a', 'c']);

        rerender(<WordMask mask={mask} />);

        expect(word.querySelectorAll('[data-hint]')).toHaveLength(0);
    });
});
