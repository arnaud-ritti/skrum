import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    ReactionPicker,
    ReactionPickerGrid,
} from '@/components/skrum/reaction-picker';
import { renderWithProviders } from '@/test/render';

const emojis = ['🎉', '👍', '❤️', '😂', '🤔', '👀', '🔥', '👏', '💡', '😮'];

function Harness({ onToggle }: { onToggle?: (emoji: string) => void }) {
    const [mine, setMine] = useState<string[]>(['👍']);

    return (
        <ReactionPicker
            trigger={<button type="button">React</button>}
            emojis={emojis}
            mine={mine}
            onToggle={(emoji) => {
                onToggle?.(emoji);
                setMine((current) =>
                    current.includes(emoji)
                        ? current.filter((item) => item !== emoji)
                        : [...current, emoji],
                );
            }}
        />
    );
}

describe('ReactionPickerGrid', () => {
    it('is a named group of toggle buttons with mine pressed', () => {
        renderWithProviders(
            <ReactionPickerGrid
                emojis={emojis}
                mine={['👍', '🔥']}
                onToggle={vi.fn()}
            />,
        );

        expect(screen.getByRole('group', { name: 'Reactions' })).toBeTruthy();
        expect(screen.getAllByRole('button')).toHaveLength(10);
        expect(
            screen
                .getAllByRole('button', { pressed: true })
                .map((button) => button.getAttribute('aria-label')),
        ).toEqual(['👍', '🔥']);
    });

    it('calls onToggle with the emoji, pressed or not', () => {
        const onToggle = vi.fn();
        renderWithProviders(
            <ReactionPickerGrid
                emojis={emojis}
                mine={['👍']}
                onToggle={onToggle}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: '👍' }));
        fireEvent.click(screen.getByRole('button', { name: '🎉' }));

        expect(onToggle.mock.calls).toEqual([['👍'], ['🎉']]);
    });

    it('keeps one tab stop and moves through the six-column grid with the arrows', () => {
        renderWithProviders(
            <ReactionPickerGrid emojis={emojis} mine={[]} onToggle={vi.fn()} />,
        );
        const buttons = screen.getAllByRole('button');
        const press = (key: string): void => {
            fireEvent.keyDown(document.activeElement as Element, { key });
        };

        expect(buttons.filter((button) => button.tabIndex === 0)).toEqual([
            buttons[0],
        ]);

        buttons[0].focus();
        press('ArrowRight');

        expect(document.activeElement).toBe(buttons[1]);
        expect(buttons[1].tabIndex).toBe(0);
        expect(buttons[0].tabIndex).toBe(-1);

        press('ArrowDown');

        expect(document.activeElement).toBe(buttons[7]);

        press('ArrowDown');

        expect(document.activeElement).toBe(buttons[7]);

        press('ArrowUp');
        press('ArrowLeft');
        press('ArrowLeft');

        expect(document.activeElement).toBe(buttons[9]);

        press('Home');

        expect(document.activeElement).toBe(buttons[0]);

        press('End');

        expect(document.activeElement).toBe(buttons[9]);
    });

    it('handles no emoji, one emoji and 200 emoji, and a shrinking list', () => {
        const many = Array.from({ length: 200 }, (_, index) => `e${index}`);
        const { rerender } = renderWithProviders(
            <ReactionPickerGrid emojis={[]} mine={[]} onToggle={vi.fn()} />,
        );

        expect(screen.queryAllByRole('button')).toHaveLength(0);

        rerender(
            <ReactionPickerGrid emojis={many} mine={[]} onToggle={vi.fn()} />,
        );
        screen.getAllByRole('button')[199].focus();

        expect(screen.getAllByRole('button')).toHaveLength(200);

        rerender(
            <ReactionPickerGrid emojis={['🎉']} mine={[]} onToggle={vi.fn()} />,
        );

        expect(screen.getByRole('button', { name: '🎉' }).tabIndex).toBe(0);
    });
});

describe('ReactionPicker', () => {
    it('opens from its trigger, stays open after a toggle and reflects it', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();
        renderWithProviders(<Harness onToggle={onToggle} />);
        const trigger = screen.getByRole('button', { name: 'React' });

        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        await user.click(trigger);

        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('dialog', { name: 'Reactions' })).toBeTruthy();

        await user.click(screen.getByRole('button', { name: '🎉' }));

        expect(onToggle).toHaveBeenCalledWith('🎉');
        expect(
            screen
                .getByRole('button', { name: '🎉' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
        expect(screen.getByRole('dialog', { name: 'Reactions' })).toBeTruthy();
    });

    it('moves focus into the grid and gives it back to the trigger on Escape', async () => {
        const user = userEvent.setup();
        renderWithProviders(<Harness />);
        const trigger = screen.getByRole('button', { name: 'React' });

        trigger.focus();
        await user.keyboard('{Enter}');

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: '🎉' }),
        );

        await user.keyboard('{ArrowRight}{Enter}');

        expect(
            screen
                .getByRole('button', { name: '👍' })
                .getAttribute('aria-pressed'),
        ).toBe('false');

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });
});
