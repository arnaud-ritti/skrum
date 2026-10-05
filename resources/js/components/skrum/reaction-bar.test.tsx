import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PokerDeck } from '@/components/skrum/poker-card';
import { ReactionBar } from '@/components/skrum/reaction-bar';
import type { IncomingReaction } from '@/components/skrum/reaction-bar';
import { renderWithProviders } from '@/test/render';

function burst(count: number, emoji = '🎉'): IncomingReaction[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `r${index}`,
        emoji,
        userName: `User ${index}`,
        presence: (index % 12) + 1,
    }));
}

describe('ReactionBar', () => {
    beforeAll(() => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe(): void {}
                unobserve(): void {}
                disconnect(): void {}
            },
        );
    });

    it('is a toolbar named Reactions with six emoji buttons', () => {
        renderWithProviders(<ReactionBar onReact={vi.fn()} />);

        const toolbar = screen.getByRole('toolbar', { name: 'Reactions' });

        expect(
            toolbar.querySelectorAll('[aria-label^="Send a reaction "]'),
        ).toHaveLength(6);
        expect(
            screen.getByRole('button', { name: 'Send a reaction 🎉' }),
        ).toBeTruthy();
    });

    it('calls onReact with the clicked emoji', () => {
        const onReact = vi.fn();

        renderWithProviders(<ReactionBar onReact={onReact} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'Send a reaction ❤️' }),
        );

        expect(onReact).toHaveBeenCalledWith('❤️');
    });

    it('keeps one tab stop and moves with the arrow keys', () => {
        renderWithProviders(
            <ReactionBar onReact={vi.fn()} onOpenPicker={vi.fn()} />,
        );

        const first = screen.getByRole('button', {
            name: 'Send a reaction 👍',
        });
        const second = screen.getByRole('button', {
            name: 'Send a reaction ❤️',
        });

        expect(first.tabIndex).toBe(0);
        expect(second.tabIndex).toBe(-1);

        first.focus();
        fireEvent.keyDown(first, { key: 'ArrowRight' });

        expect(document.activeElement).toBe(second);
        expect(second.tabIndex).toBe(0);
        expect(first.tabIndex).toBe(-1);

        fireEvent.keyDown(second, { key: 'End' });

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Add a reaction' }),
        );
    });

    it('reacts to keys 1 to 6 only when shortcuts is true', () => {
        const onReact = vi.fn();
        const { rerender } = renderWithProviders(
            <ReactionBar onReact={onReact} />,
        );

        fireEvent.keyDown(document.body, { key: '4' });

        expect(onReact).not.toHaveBeenCalled();

        rerender(<ReactionBar onReact={onReact} shortcuts />);
        fireEvent.keyDown(document.body, { key: '4' });
        fireEvent.keyDown(document.body, { key: '7' });

        expect(onReact).toHaveBeenCalledTimes(1);
        expect(onReact).toHaveBeenCalledWith('🎉');
    });

    it('sends the visible emoji of a digit when compact', () => {
        const onReact = vi.fn();
        renderWithProviders(
            <ReactionBar onReact={onReact} compact shortcuts />,
        );

        fireEvent.keyDown(document.body, { key: '3' });
        fireEvent.keyDown(document.body, { key: '4' });

        expect(onReact).toHaveBeenCalledTimes(1);
        expect(onReact).toHaveBeenCalledWith('🎉');
    });

    it('sends no reaction for a digit typed inside a dialog', () => {
        const onReact = vi.fn();
        const { rerender } = renderWithProviders(
            <ReactionBar onReact={onReact} shortcuts disabled />,
        );
        const dialog = document.createElement('div');
        const button = document.createElement('button');

        dialog.setAttribute('role', 'dialog');
        dialog.append(button);
        document.body.append(dialog);

        rerender(<ReactionBar onReact={onReact} shortcuts />);
        fireEvent.keyDown(button, { key: '1' });
        dialog.remove();

        expect(onReact).not.toHaveBeenCalled();
    });

    it('sends no reaction for a digit pressed on a focused deck card', () => {
        const onReact = vi.fn();
        const onChange = vi.fn();

        renderWithProviders(
            <>
                <PokerDeck
                    values={['1', '2', '3']}
                    value={null}
                    onChange={onChange}
                />
                <ReactionBar onReact={onReact} shortcuts />
            </>,
        );

        const card = screen.getByRole('button', { name: 'Play 1' });

        card.focus();
        fireEvent.keyDown(card, { key: '2' });
        fireEvent.keyDown(card, { key: '5' });

        expect(onChange).toHaveBeenCalledWith('2');
        expect(onReact).not.toHaveBeenCalled();
    });

    it('ignores a digit typed with a modifier or in a role textbox', () => {
        const onReact = vi.fn();

        renderWithProviders(
            <>
                <div role="textbox" aria-label="Editor" tabIndex={0} />
                <ReactionBar onReact={onReact} shortcuts />
            </>,
        );

        fireEvent.keyDown(document.body, { key: '1', ctrlKey: true });
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Editor' }), {
            key: '1',
        });

        expect(onReact).not.toHaveBeenCalled();
    });

    it('ignores shortcuts typed in a text field', () => {
        const onReact = vi.fn();

        renderWithProviders(
            <>
                <input aria-label="Note" />
                <ReactionBar onReact={onReact} shortcuts />
            </>,
        );
        fireEvent.keyDown(screen.getByLabelText('Note'), { key: '1' });

        expect(onReact).not.toHaveBeenCalled();
    });

    it('does not emit while disabled and shows the reason', () => {
        const onReact = vi.fn();

        renderWithProviders(
            <ReactionBar
                onReact={onReact}
                shortcuts
                disabled
                disabledReason="Facilitator locked reactions."
            />,
        );

        const button = screen.getByRole('button', {
            name: 'Send a reaction 👍',
        });

        fireEvent.click(button);
        fireEvent.keyDown(document.body, { key: '1' });

        expect(onReact).not.toHaveBeenCalled();
        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(button.hasAttribute('disabled')).toBe(false);
        expect(screen.getByText('Facilitator locked reactions.')).toBeTruthy();
    });

    it('shows three emojis and a more button when compact', () => {
        renderWithProviders(<ReactionBar onReact={vi.fn()} compact />);

        const toolbar = screen.getByRole('toolbar', { name: 'Reactions' });

        expect(
            toolbar.querySelectorAll('[aria-label^="Send a reaction "]'),
        ).toHaveLength(3);
        expect(
            screen.getByRole('button', { name: 'More reactions' }),
        ).toBeTruthy();
    });

    it('opens the picker through onOpenPicker and reflects pickerOpen', () => {
        const onOpenPicker = vi.fn();
        const { rerender } = renderWithProviders(
            <ReactionBar onReact={vi.fn()} onOpenPicker={onOpenPicker} />,
        );
        const add = screen.getByRole('button', { name: 'Add a reaction' });

        expect(add.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(add);

        expect(onOpenPicker).toHaveBeenCalledTimes(1);

        rerender(
            <ReactionBar
                onReact={vi.fn()}
                onOpenPicker={onOpenPicker}
                pickerOpen
                picker={<div data-testid="slot" />}
            />,
        );

        expect(add.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByTestId('slot')).toBeTruthy();
    });

    it('renders a picker slot alone as the last toolbar item', () => {
        renderWithProviders(
            <ReactionBar
                onReact={vi.fn()}
                picker={<button type="button">Custom picker</button>}
            />,
        );

        expect(
            screen
                .getByRole('toolbar', { name: 'Reactions' })
                .contains(screen.getByText('Custom picker')),
        ).toBe(true);
    });

    it('keeps the aggregated chips of a burst in one row above the lane of the flying reactions', () => {
        const { container } = renderWithProviders(
            <ReactionBar onReact={vi.fn()} incoming={burst(200)} />,
        );
        const row = container.querySelector(
            '[data-slot="reaction-aggregates"]',
        ) as HTMLElement;

        expect(row.className).toContain('bottom-full');
        expect(row.className).toContain('flex-wrap');
        expect(
            row.querySelectorAll('[data-slot="reaction-aggregate"]').length,
        ).toBe(
            container.querySelectorAll('[data-slot="reaction-aggregate"]')
                .length,
        );
        expect(
            row.contains(container.querySelector('[data-slot="reaction-fly"]')),
        ).toBe(false);
    });

    it('caps flying reactions at 12 and aggregates the rest', () => {
        const { container, rerender } = renderWithProviders(
            <ReactionBar onReact={vi.fn()} incoming={burst(20)} />,
        );

        expect(
            container.querySelectorAll('[data-slot="reaction-fly"]'),
        ).toHaveLength(12);
        expect(
            container.querySelector('[data-slot="reaction-aggregate"]')
                ?.textContent,
        ).toContain('🎉 ×8');
        expect(
            container.querySelector('[data-slot="reaction-aggregate"]')
                ?.textContent,
        ).toContain('User 0 and 7 others');

        rerender(<ReactionBar onReact={vi.fn()} incoming={burst(14)} />);

        expect(
            container.querySelector('[data-slot="reaction-aggregate"]')
                ?.textContent,
        ).toMatch(/User 0 and 1 other$/);

        rerender(<ReactionBar onReact={vi.fn()} incoming={burst(3)} />);

        expect(
            container.querySelectorAll('[data-slot="reaction-fly"]'),
        ).toHaveLength(3);
        expect(
            container.querySelector('[data-slot="reaction-aggregate"]'),
        ).toBeNull();
    });

    it('names one other reactor in the singular', () => {
        const { container } = renderWithProviders(
            <ReactionBar onReact={vi.fn()} incoming={burst(14)} />,
        );

        expect(
            container.querySelector('[data-slot="reaction-aggregate"]')
                ?.textContent,
        ).toMatch(/User 0 and 1 other(?!s)/);
    });

    it('hides flying emojis from assistive tech and pulses under reduced motion', () => {
        const { container } = renderWithProviders(
            <ReactionBar onReact={vi.fn()} incoming={burst(1)} />,
        );

        expect(
            container
                .querySelector('[data-slot="reaction-incoming"]')
                ?.getAttribute('aria-hidden'),
        ).toBe('true');
        expect(
            container.querySelector('[data-slot="reaction-fly"]')?.className,
        ).toContain('motion-reduce:animate-pulse');
    });

    it('stacks above a panel through offsetBottom', () => {
        const { container } = renderWithProviders(
            <ReactionBar onReact={vi.fn()} offsetBottom={9} />,
        );
        const root = container.querySelector(
            '[data-slot="reaction-bar"]',
        ) as HTMLElement;

        expect(root.style.getPropertyValue('--reaction-offset')).toBe(
            'calc(9rem + 0.75rem)',
        );
    });

    it('has no shadow pill when inline', () => {
        renderWithProviders(<ReactionBar onReact={vi.fn()} variant="inline" />);

        expect(
            screen.getByRole('toolbar', { name: 'Reactions' }).className,
        ).not.toContain('shadow-raised');
    });
});
