import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Flag } from 'lucide-react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const LongLabel =
    'Estimation of the whole checkout rewrite including the payment provider migration';

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

function Example({ onValueChange }: { onValueChange?: (value: string) => void }) {
    return (
        <Select defaultValue="long" onValueChange={onValueChange}>
            <SelectTrigger aria-label="Estimate" className="w-32">
                <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="long">{LongLabel}</SelectItem>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="parts">
                    {'Atlas'} ·{' '}
                    {'Scrum board'}
                    {3}
                </SelectItem>
                <SelectItem value="icon">
                    <Flag />
                    High
                </SelectItem>
            </SelectContent>
        </Select>
    );
}

describe('SelectTrigger', () => {
    it('truncates a long value with an ellipsis instead of clipping it', () => {
        render(<Example />);

        const trigger = screen.getByRole('combobox', { name: 'Estimate' });
        const value = trigger.querySelector<HTMLElement>(
            '[data-slot="select-value"]',
        );
        const triggerClasses = trigger.className.split(/\s+/);

        expect(value?.textContent).toBe(LongLabel);
        expect(triggerClasses).toContain('min-w-0');
        expect(triggerClasses).toContain('*:data-[slot=select-value]:block');
        expect(triggerClasses).toContain('*:data-[slot=select-value]:truncate');
        expect(triggerClasses).toContain('*:data-[slot=select-value]:min-w-0');
        expect(trigger.className).not.toContain('line-clamp-1');
        expect(triggerClasses).not.toContain('*:data-[slot=select-value]:flex');
    });
});

describe('SelectItem', () => {
    it('wraps a text label in a truncating span and leaves icons alone', async () => {
        const user = userEvent.setup();
        render(<Example />);

        await user.click(screen.getByRole('combobox', { name: 'Estimate' }));
        const listbox = screen.getByRole('listbox');

        expect(
            within(listbox).getByText(LongLabel).className.split(/\s+/),
        ).toContain('truncate');

        const withIcon = within(listbox).getByRole('option', { name: 'High' });

        expect(withIcon.querySelector('svg')).not.toBeNull();
        expect(
            within(withIcon).getByText('High').className.split(/\s+/),
        ).toContain('truncate');
        expect(withIcon.querySelector('svg')?.closest('.truncate')).toBeNull();
    });
});

describe('SelectItem with several text children', () => {
    it('keeps the pieces of one label in a single truncating span', async () => {
        const user = userEvent.setup();
        render(<Example />);

        await user.click(screen.getByRole('combobox', { name: 'Estimate' }));
        const option = within(screen.getByRole('listbox')).getByRole('option', {
            name: 'Atlas · Scrum board3',
        });
        const pieces = option.querySelectorAll('.truncate');

        expect(pieces).toHaveLength(1);
        expect(pieces[0].textContent).toBe('Atlas · Scrum board3');
    });
});

describe('Select keyboard', () => {
    it('opens with Enter, picks with the arrows and returns focus to the trigger', async () => {
        const onValueChange = vi.fn();
        const user = userEvent.setup();
        render(<Example onValueChange={onValueChange} />);
        const trigger = screen.getByRole('combobox', { name: 'Estimate' });

        trigger.focus();
        await user.keyboard('{Enter}');

        expect(screen.getByRole('listbox')).not.toBeNull();
        expect(trigger.getAttribute('aria-expanded')).toBe('true');

        await user.keyboard('{ArrowDown}{Enter}');

        expect(onValueChange).toHaveBeenCalledWith('short');
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('closes on Escape without changing the value', async () => {
        const onValueChange = vi.fn();
        const user = userEvent.setup();
        render(<Example onValueChange={onValueChange} />);
        const trigger = screen.getByRole('combobox', { name: 'Estimate' });

        trigger.focus();
        await user.keyboard('{Enter}');
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('listbox')).toBeNull();
        expect(onValueChange).not.toHaveBeenCalled();
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
});
