import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkrumLogo } from '@/components/skrum/skrum-logo';

describe('SkrumLogo', () => {
    it.each(['horizontal', 'symbol', 'wordmark'] as const)(
        'renders the %s variant as a labelled image',
        (variant) => {
            render(<SkrumLogo variant={variant} />);

            expect(screen.getByRole('img', { name: 'Skrüm' })).toBeTruthy();
        },
    );

    it('paints with tokens only', () => {
        const { container } = render(<SkrumLogo />);

        expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
        expect(
            container.querySelectorAll('[fill^="#"], [stroke^="#"]'),
        ).toHaveLength(0);
    });

    it('draws both the tile and the wordmark in the horizontal variant', () => {
        const { container } = render(<SkrumLogo variant="horizontal" />);

        expect(container.querySelector('[data-part="symbol"]')).not.toBeNull();
        expect(
            container.querySelector('[data-part="wordmark"]'),
        ).not.toBeNull();
    });
});
