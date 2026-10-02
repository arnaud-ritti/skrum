import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sun } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { renderWithProviders } from '@/test/render';

const items = [
    { value: 'todo', label: 'To do', count: 6 },
    { value: 'late', label: 'Late', icon: Sun },
    { value: 'done', label: 'Done', disabled: true },
    { value: 'all', label: 'All' },
];

function Controlled({ onChange }: { onChange?: (value: string) => void }) {
    const [value, setValue] = useState('todo');

    return (
        <Tabs
            value={value}
            onValueChange={(next) => {
                setValue(next);
                onChange?.(next);
            }}
            items={items}
            aria-label="Actions"
        >
            <TabsContent value="todo">todo panel</TabsContent>
            <TabsContent value="late">late panel</TabsContent>
        </Tabs>
    );
}

describe('Tabs', () => {
    it('exposes a labelled tablist with the selected tab and its panel', () => {
        renderWithProviders(<Controlled />);

        expect(screen.getByRole('tablist', { name: 'Actions' })).toBeTruthy();
        const todo = screen.getByRole('tab', { name: 'To do,6' });
        expect(todo.getAttribute('aria-selected')).toBe('true');
        expect(todo.getAttribute('aria-controls')).toBeTruthy();
        expect(screen.getByRole('tabpanel').textContent).toBe('todo panel');
    });

    it('moves selection with arrow keys, skipping disabled tabs, and Home/End', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderWithProviders(<Controlled onChange={onChange} />);

        await user.tab();
        expect(document.activeElement?.textContent).toContain('To do');

        await user.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenLastCalledWith('late');

        await user.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenLastCalledWith('all');

        await user.keyboard('{Home}');
        expect(onChange).toHaveBeenLastCalledWith('todo');

        await user.keyboard('{End}');
        expect(onChange).toHaveBeenLastCalledWith('all');
    });

    it('keeps a single tab stop', () => {
        renderWithProviders(<Controlled />);

        const stops = [
            screen.getByRole('tablist'),
            ...screen.getAllByRole('tab'),
        ].filter((element) => element.getAttribute('tabindex') === '0');

        expect(stops).toHaveLength(1);
    });

    it('updates a count live without changing the active tab', () => {
        const { rerender } = renderWithProviders(
            <Tabs value="todo" onValueChange={() => {}} items={items} aria-label="A" />,
        );

        rerender(
            <Tabs
                value="todo"
                onValueChange={() => {}}
                items={[{ ...items[0], count: 7 }, ...items.slice(1)]}
                aria-label="A"
            />,
        );

        const todo = screen.getByRole('tab', { name: 'To do,7' });
        expect(todo.getAttribute('aria-selected')).toBe('true');
    });

    it('does not select a disabled tab', () => {
        const onChange = vi.fn();
        renderWithProviders(<Controlled onChange={onChange} />);

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Done' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('renders the line variant and full width flags on the list', () => {
        renderWithProviders(
            <Tabs
                value="todo"
                onValueChange={() => {}}
                items={items}
                variant="line"
                fullWidth
                aria-label="Line"
            />,
        );

        const list = screen.getByRole('tablist');
        expect(list.getAttribute('data-variant')).toBe('line');
    });
});

describe('TabsContent focus', () => {
    it('is a tab stop with a visible focus ring', async () => {
        const user = userEvent.setup();
        renderWithProviders(<Controlled />);
        const panel = screen.getByRole('tabpanel');

        await user.tab();
        await user.tab();

        expect(document.activeElement).toBe(panel);
        expect(panel.className).toContain('focus-visible:ring-2');
        expect(panel.className).toContain('focus-visible:ring-ring');
    });
});
