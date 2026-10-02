import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ReactionDrawer } from '@/components/skrum/reaction-drawer';
import { VoteDrawer } from '@/components/skrum/vote-drawer';
import { renderWithProviders } from '@/test/render';

const deck = ['1', '2', '3', '5', '8', '13', '21', '?', '☕'];

describe('VoteDrawer', () => {
    it('renders the deck as a radiogroup with the current value checked', () => {
        renderWithProviders(
            <VoteDrawer
                open
                onOpenChange={vi.fn()}
                deck={deck}
                value="5"
                onVote={vi.fn()}
            />,
        );

        expect(screen.getByRole('radiogroup')).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(9);
        expect(
            screen
                .getByRole('radio', { name: '5 points' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.getByRole('radio', { name: '1 point' })).toBeTruthy();
    });

    it('puts the picked value in the confirm label and votes on confirm', () => {
        const onVote = vi.fn();
        const onOpenChange = vi.fn();
        renderWithProviders(
            <VoteDrawer
                open
                onOpenChange={onOpenChange}
                deck={deck}
                onVote={onVote}
            />,
        );

        fireEvent.click(screen.getByRole('radio', { name: '8 points' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Validate 8 points' }),
        );

        expect(onVote).toHaveBeenCalledWith('8');
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('disables confirm until a card is picked', () => {
        renderWithProviders(
            <VoteDrawer
                open
                onOpenChange={vi.fn()}
                deck={deck}
                onVote={vi.fn()}
            />,
        );

        expect(
            screen
                .getByRole('button', { name: 'Validate my vote' })
                .hasAttribute('disabled'),
        ).toBe(true);
    });

    it('disables unavailable cards', () => {
        renderWithProviders(
            <VoteDrawer
                open
                onOpenChange={vi.fn()}
                deck={deck}
                disabledValues={['13']}
                onVote={vi.fn()}
            />,
        );

        expect(
            screen
                .getByRole('radio', { name: '13 points' })
                .hasAttribute('disabled'),
        ).toBe(true);
    });

    it('moves the selection with arrow keys and skips unavailable cards', () => {
        renderWithProviders(
            <VoteDrawer
                open
                onOpenChange={vi.fn()}
                deck={deck}
                disabledValues={['2']}
                value="1"
                onVote={vi.fn()}
            />,
        );

        fireEvent.keyDown(screen.getByRole('radio', { name: '1 point' }), {
            key: 'ArrowRight',
        });

        expect(
            screen
                .getByRole('radio', { name: '3 points' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('shows retract only with a vote and calls onRetract', () => {
        const onRetract = vi.fn();
        const { rerender } = renderWithProviders(
            <VoteDrawer
                open
                onOpenChange={vi.fn()}
                deck={deck}
                onVote={vi.fn()}
                onRetract={onRetract}
            />,
        );

        expect(
            screen.queryByRole('button', { name: 'Remove my vote' }),
        ).toBeNull();

        rerender(
            <VoteDrawer
                open
                onOpenChange={vi.fn()}
                deck={deck}
                value="3"
                onVote={vi.fn()}
                onRetract={onRetract}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Remove my vote' }));

        expect(onRetract).toHaveBeenCalledTimes(1);
    });

    it('closes itself when revealed turns true while open', () => {
        const onOpenChange = vi.fn();
        const { rerender } = renderWithProviders(
            <VoteDrawer
                open
                onOpenChange={onOpenChange}
                deck={deck}
                onVote={vi.fn()}
            />,
        );

        expect(onOpenChange).not.toHaveBeenCalled();

        rerender(
            <VoteDrawer
                open
                revealed
                onOpenChange={onOpenChange}
                deck={deck}
                onVote={vi.fn()}
            />,
        );

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('handles 20 values with long labels', () => {
        const many = Array.from({ length: 19 }, (_, index) => `${index}`);
        renderWithProviders(
            <VoteDrawer
                open
                onOpenChange={vi.fn()}
                deck={[...many, 'Too big!!']}
                onVote={vi.fn()}
            />,
        );

        expect(screen.getAllByRole('radio')).toHaveLength(20);
        expect(screen.getByRole('radio', { name: 'Too big!!' })).toBeTruthy();
    });

    it('returns focus to the opener on close', async () => {
        function Harness() {
            const [open, setOpen] = useState(false);

            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>
                        Open
                    </button>
                    <VoteDrawer
                        open={open}
                        onOpenChange={setOpen}
                        deck={deck}
                        onVote={vi.fn()}
                    />
                </>
            );
        }
        renderWithProviders(<Harness />);
        const opener = screen.getByRole('button', { name: 'Open' });
        opener.focus();
        fireEvent.click(opener);
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        await vi.waitFor(() => expect(document.activeElement).toBe(opener));
    });
});

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

    it('shows reactions that are outside the palette', () => {
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
            screen.getByRole('button', { name: '🦄, 1 reactions' }),
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
