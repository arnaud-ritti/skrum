import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PokerCard, PokerDeck } from '@/components/skrum/poker-card';
import { renderWithProviders } from '@/test/render';

describe('PokerCard', () => {
    it('keeps the value out of the DOM while face down', () => {
        const { container } = renderWithProviders(
            <PokerCard value="13" faceDown />,
        );

        expect(container.textContent).not.toContain('13');
        expect(
            screen.getByRole('img', { name: 'Face-down card' }),
        ).toBeTruthy();
    });

    it('puts the value in the DOM when it is revealed and removes it again on reset', () => {
        const { container, rerender } = renderWithProviders(
            <PokerCard value="13" faceDown />,
        );

        rerender(<PokerCard value="13" />);

        expect(
            container.querySelector('[data-slot="poker-card-value"]')
                ?.textContent,
        ).toBe('13');

        rerender(<PokerCard value="13" faceDown />);

        expect(container.textContent).not.toContain('13');
    });

    it('is not selectable while face down', () => {
        renderWithProviders(
            <PokerCard value="5" faceDown onSelect={vi.fn()} />,
        );

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows nothing for a seat without a vote', () => {
        const { container } = renderWithProviders(
            <PokerCard value="5" empty />,
        );

        expect(container.textContent).toBe('');
        expect(screen.getByRole('img', { name: 'No vote' })).toBeTruthy();
    });

    it('applies the stagger delay to the flip only when revealing', () => {
        const { container, rerender } = renderWithProviders(
            <PokerCard value="5" delay={120} />,
        );
        const flip = () =>
            container.querySelector<HTMLElement>(
                '[data-slot="poker-card-flip"]',
            );

        expect(flip()?.style.transitionDelay).toBe('120ms');

        rerender(<PokerCard value="5" delay={120} faceDown />);

        expect(flip()?.style.transitionDelay).toBe('0ms');
    });

    it('names the special cards', () => {
        renderWithProviders(
            <>
                <PokerCard value="?" />
                <PokerCard value="☕" />
            </>,
        );

        expect(screen.getByRole('img', { name: "I don't know" })).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Need a break' })).toBeTruthy();
    });

    it('renders an 8-character value in full and calls onSelect', () => {
        const onSelect = vi.fn();
        renderWithProviders(<PokerCard value="Infinite" onSelect={onSelect} />);

        fireEvent.click(screen.getByRole('button', { name: 'Play Infinite' }));

        expect(screen.getByText('Infinite')).toBeTruthy();
        expect(onSelect).toHaveBeenCalledWith('Infinite');
    });

    it('does not call onSelect when disabled', () => {
        const onSelect = vi.fn();
        renderWithProviders(
            <PokerCard value="8" disabled onSelect={onSelect} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Play 8' }));

        expect(onSelect).not.toHaveBeenCalled();
    });
});

const fibonacci = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];

function Harness({ values = fibonacci }: { values?: string[] }) {
    const [value, setValue] = useState<string | null>(null);

    return (
        <>
            <PokerDeck
                values={values}
                value={value}
                onChange={setValue}
                onRetract={() => setValue(null)}
            />
            <output data-testid="current">{value ?? 'none'}</output>
        </>
    );
}

describe('PokerDeck', () => {
    it('is a group of pressed buttons named "Play :card" by default', () => {
        renderWithProviders(
            <PokerDeck values={fibonacci} value="5" onChange={vi.fn()} />,
        );

        expect(screen.getByRole('group', { name: 'Your cards' })).toBeTruthy();
        expect(screen.getAllByRole('button')).toHaveLength(10);
        expect(
            screen
                .getByRole('button', { name: 'Play 5' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
        expect(
            screen
                .getByRole('button', { name: 'Play 8' })
                .getAttribute('aria-pressed'),
        ).toBe('false');
    });

    it('is a radiogroup of radios when selection is radio', () => {
        renderWithProviders(
            <PokerDeck
                values={fibonacci}
                value="5"
                selection="radio"
                onChange={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('radiogroup', { name: 'Your cards' }),
        ).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(10);
        expect(
            screen
                .getByRole('radio', { name: 'Play 5' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('withdraws the vote when the selected card is pressed again', () => {
        renderWithProviders(<Harness />);

        fireEvent.click(screen.getByRole('button', { name: 'Play 5' }));

        expect(screen.getByTestId('current').textContent).toBe('5');

        fireEvent.click(screen.getByRole('button', { name: 'Play 5' }));

        expect(screen.getByTestId('current').textContent).toBe('none');
    });

    it('keeps every digit pressed on a focused card away from page shortcuts', () => {
        renderWithProviders(
            <PokerDeck values={['XS', '3']} value={null} onChange={vi.fn()} />,
        );
        const card = screen.getByRole('button', { name: 'Play XS' });

        expect(fireEvent.keyDown(card, { key: '3' })).toBe(false);
        expect(fireEvent.keyDown(card, { key: '4' })).toBe(false);
    });

    it('keeps one tab stop: the selected card, else the first', () => {
        const { rerender } = renderWithProviders(
            <PokerDeck values={fibonacci} value={null} onChange={vi.fn()} />,
        );
        const tabStops = () =>
            screen
                .getAllByRole('button')
                .filter((radio) => radio.tabIndex === 0)
                .map((radio) => radio.getAttribute('aria-label'));

        expect(tabStops()).toEqual(['Play 0']);

        rerender(<PokerDeck values={fibonacci} value="8" onChange={vi.fn()} />);

        expect(tabStops()).toEqual(['Play 8']);
    });

    it('moves focus with arrows, wraps, and does not select', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <PokerDeck values={fibonacci} value={null} onChange={onChange} />,
        );
        const first = screen.getByRole('button', { name: 'Play 0' });
        first.focus();

        fireEvent.keyDown(first, { key: 'ArrowRight' });

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Play 1' }),
        );

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowLeft',
        });
        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowLeft',
        });

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Play ☕' }),
        );
        expect(onChange).not.toHaveBeenCalled();
    });

    it('selects with a click (Space activates the focused button)', () => {
        renderWithProviders(<Harness />);

        fireEvent.click(screen.getByRole('button', { name: 'Play 13' }));

        expect(screen.getByTestId('current').textContent).toBe('13');
    });

    it('retracts the vote when the digit of the selected card is pressed, like a click on it', () => {
        const onChange = vi.fn();
        const onRetract = vi.fn();
        renderWithProviders(
            <PokerDeck
                values={fibonacci}
                value="5"
                onChange={onChange}
                onRetract={onRetract}
            />,
        );

        fireEvent.keyDown(screen.getByRole('button', { name: 'Play 5' }), {
            key: '5',
        });

        expect(onRetract).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps the digit of the selected card a plain choice in radio mode', () => {
        const onChange = vi.fn();
        const onRetract = vi.fn();
        renderWithProviders(
            <PokerDeck
                values={fibonacci}
                value="5"
                selection="radio"
                onChange={onChange}
                onRetract={onRetract}
            />,
        );

        fireEvent.keyDown(screen.getByRole('radio', { checked: true }), {
            key: '5',
        });

        expect(onChange).toHaveBeenCalledWith('5');
        expect(onRetract).not.toHaveBeenCalled();
    });

    it('selects a digit directly, only from inside the deck', () => {
        renderWithProviders(<Harness />);

        fireEvent.keyDown(document.body, { key: '3' });

        expect(screen.getByTestId('current').textContent).toBe('none');

        const first = screen.getByRole('button', { name: 'Play 0' });
        first.focus();
        fireEvent.keyDown(first, { key: '3' });

        expect(screen.getByTestId('current').textContent).toBe('3');
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Play 3' }),
        );
    });

    it('ignores a digit with no matching card', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <PokerDeck
                values={['XS', 'S', 'M']}
                value={null}
                onChange={onChange}
            />,
        );
        const card = screen.getByRole('button', { name: 'Play XS' });

        fireEvent.keyDown(card, { key: '4' });

        expect(onChange).not.toHaveBeenCalled();
    });

    it('retracts the vote with Escape', () => {
        renderWithProviders(<Harness />);
        const card = screen.getByRole('button', { name: 'Play 5' });

        fireEvent.click(card);
        fireEvent.keyDown(card, { key: 'Escape' });

        expect(screen.getByTestId('current').textContent).toBe('none');
    });

    it('skips disabled cards when moving and refuses them', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <PokerDeck
                values={['1', '2', '3']}
                value={null}
                disabledValues={['2']}
                onChange={onChange}
            />,
        );
        const first = screen.getByRole('button', { name: 'Play 1' });
        first.focus();

        fireEvent.keyDown(first, { key: 'ArrowRight' });
        fireEvent.keyDown(first, { key: '2' });

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Play 3' }),
        );
        expect(onChange).not.toHaveBeenCalled();
    });

    it('disables every card when the round is closed', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <PokerDeck
                values={fibonacci}
                value={null}
                disabled
                onChange={onChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Play 1' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('renders 2 and 20 values and follows a changed deck', () => {
        const twenty = Array.from({ length: 20 }, (_, index) => `${index * 5}`);
        const { rerender } = renderWithProviders(
            <PokerDeck values={['S', 'L']} value="S" onChange={vi.fn()} />,
        );

        expect(screen.getAllByRole('button')).toHaveLength(2);

        rerender(<PokerDeck values={twenty} value="95" onChange={vi.fn()} />);

        expect(screen.getAllByRole('button')).toHaveLength(20);
        expect(
            screen
                .getByRole('button', { name: 'Play 95' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
        expect(screen.getByRole('group').className).toContain('flex-wrap');
    });
});
