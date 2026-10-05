import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VoteDrawer, VoteDrawerPanel } from '@/components/skrum/vote-drawer';
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

    it('holds a 20-value deck: every card reachable, an 8-character value in full, vote on the last', () => {
        const onVote = vi.fn();
        const twenty = [
            ...Array.from({ length: 17 }, (_, index) => `${index + 1}`),
            'XXL-size',
            '?',
            '☕',
        ];
        renderWithProviders(
            <VoteDrawer
                open
                onOpenChange={vi.fn()}
                deck={twenty}
                value="1"
                disabledValues={['17']}
                onVote={onVote}
            />,
        );
        const cards = screen.getAllByRole('radio');

        expect(cards).toHaveLength(20);
        expect(cards.filter((card) => card.tabIndex === 0)).toHaveLength(1);
        expect(
            screen.getByRole('radio', { name: 'XXL-size' }).textContent,
        ).toBe('XXL-size');

        cards[0].focus();
        fireEvent.keyDown(cards[0], { key: 'ArrowLeft' });

        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Coffee break' }),
        );

        fireEvent.keyDown(cards[15], { key: 'ArrowRight' });

        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'XXL-size' }),
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Validate XXL-size' }),
        );

        expect(onVote).toHaveBeenCalledWith('XXL-size');
    });

    it('renders the panel without a drawer and leaves closing to its host', () => {
        const onVote = vi.fn();
        const onRetract = vi.fn();
        renderWithProviders(
            <VoteDrawerPanel
                deck={deck}
                value="5"
                onVote={onVote}
                onRetract={onRetract}
            />,
        );

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(
            screen
                .getByRole('radio', { name: '5 points' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.click(screen.getByRole('radio', { name: '8 points' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Validate 8 points' }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Remove my vote' }));

        expect(onVote).toHaveBeenCalledWith('8');
        expect(onRetract).toHaveBeenCalledTimes(1);
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

    it('moves to the first and last available card with Home and End', () => {
        renderWithProviders(
            <VoteDrawerPanel
                deck={deck}
                value="5"
                disabledValues={['1', '☕']}
                onVote={vi.fn()}
            />,
        );

        fireEvent.keyDown(screen.getByRole('radio', { name: '5 points' }), {
            key: 'End',
        });

        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Not sure' }),
        );

        fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });

        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: '2 points' }),
        );
        expect(
            screen
                .getByRole('radio', { name: '2 points' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('does not offer to validate a current value that is no longer available', () => {
        const onVote = vi.fn();
        renderWithProviders(
            <VoteDrawerPanel
                deck={deck}
                value="8"
                disabledValues={['8']}
                onVote={onVote}
            />,
        );

        const confirm = screen.getByRole('button', {
            name: 'Validate my vote',
        });

        expect((confirm as HTMLButtonElement).disabled).toBe(true);
    });

    it('follows the value when the host changes it', () => {
        const { rerender } = renderWithProviders(
            <VoteDrawerPanel deck={deck} value="5" onVote={vi.fn()} />,
        );

        rerender(<VoteDrawerPanel deck={deck} value={null} onVote={vi.fn()} />);

        expect(
            screen.getByRole('button', { name: 'Validate my vote' }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('radio', { name: '5 points' })
                .getAttribute('aria-checked'),
        ).toBe('false');
    });
});
