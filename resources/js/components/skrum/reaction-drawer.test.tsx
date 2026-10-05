import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReactionDrawer } from '@/components/skrum/reaction-drawer';
import { renderWithProviders } from '@/test/render';

describe('ReactionDrawer', () => {
    const palette = ['🎉', '👍', '❤️', '😂', '🤔', '👀'];

    it('marks my reactions as pressed and reacts on click', () => {
        const onReact = vi.fn();
        renderWithProviders(
            <ReactionDrawer
                open
                onOpenChange={vi.fn()}
                cardExcerpt="Daily takes too long"
                palette={palette}
                reactions={[{ emoji: '🎉', count: 2, mine: true }]}
                onReact={onReact}
            />,
        );

        const mine = screen.getByRole('button', { name: '🎉, 2 reactions' });
        expect(mine.getAttribute('aria-pressed')).toBe('true');
        expect(
            screen
                .getByRole('button', { name: '👍' })
                .getAttribute('aria-pressed'),
        ).toBe('false');

        fireEvent.click(screen.getByRole('button', { name: '👍' }));

        expect(onReact).toHaveBeenCalledWith('👍');
    });

    it('shows reactions that are outside the palette, in the singular for one', () => {
        renderWithProviders(
            <ReactionDrawer
                open
                onOpenChange={vi.fn()}
                cardExcerpt={'x'.repeat(280)}
                palette={palette}
                reactions={[{ emoji: '🦄', count: 1, mine: false }]}
                onReact={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('button', { name: '🦄, 1 reaction' }),
        ).toBeTruthy();
    });

    it('renders nothing when closed', () => {
        renderWithProviders(
            <ReactionDrawer
                open={false}
                onOpenChange={vi.fn()}
                cardExcerpt="x"
                palette={palette}
                reactions={[]}
                onReact={vi.fn()}
            />,
        );

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
