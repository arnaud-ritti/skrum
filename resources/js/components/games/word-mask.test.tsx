import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WordMask } from './word-mask';

describe('WordMask', () => {
    it('counts the letters left in its name and spells the letters found with their places in its description', () => {
        render(<WordMask mask={['q', null, null, ' ', "'", 'z', null]} />);

        const mask = screen.getByRole('img', {
            name: '3 letters left to find',
        });

        expect(mask.getAttribute('aria-description')).toBe(
            "Q, blank, blank, space, ', Z, blank",
        );
    });
});
