import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SentimentIcon } from '@/components/retro/card-insight';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: { Negative: 'Négatif' } } }),
}));

describe('SentimentIcon', () => {
    it('renders nothing for a card without sentiment', () => {
        const { container } = render(<SentimentIcon sentiment={null} />);

        expect(container.innerHTML).toBe('');
    });

    it.each([
        ['positive', 'Positive'],
        ['neutral', 'Neutral'],
        ['negative', 'Négatif'],
    ] as const)('names the %s sentiment', (sentiment, name) => {
        render(<SentimentIcon sentiment={sentiment} />);

        expect(screen.getByRole('img', { name })).toBeTruthy();
    });
});
