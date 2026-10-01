import { fireEvent, screen } from '@testing-library/react';
import { History, Timer } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Accordion } from '@/components/ui/accordion';
import { CollapsibleBlock } from '@/components/ui/collapsible';
import { renderWithProviders } from '@/test/render';

const items = [
    { value: 'a', title: 'First', summary: '5 min', icon: Timer, content: <p>Alpha body</p> },
    { value: 'b', title: 'Second', content: <p>Beta body</p> },
    { value: 'c', title: 'Third', disabled: true, content: <p>Gamma body</p> },
];

describe('Accordion', () => {
    it('opens one item at a time in single mode and closes it when collapsible', () => {
        renderWithProviders(<Accordion type="single" collapsible items={items} />);

        const first = screen.getByRole('button', { name: /First/ });
        const second = screen.getByRole('button', { name: /Second/ });
        expect(first.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(first);
        expect(first.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('region', { name: /First/ }).textContent).toContain('Alpha body');

        fireEvent.click(second);
        expect(first.getAttribute('aria-expanded')).toBe('false');
        expect(second.getAttribute('aria-expanded')).toBe('true');

        fireEvent.click(second);
        expect(second.getAttribute('aria-expanded')).toBe('false');
    });

    it('keeps several items open in multiple mode and reports the values', () => {
        const onValueChange = vi.fn();
        renderWithProviders(
            <Accordion type="multiple" items={items} onValueChange={onValueChange} />,
        );

        fireEvent.click(screen.getByRole('button', { name: /First/ }));
        fireEvent.click(screen.getByRole('button', { name: /Second/ }));

        expect(onValueChange).toHaveBeenLastCalledWith(['a', 'b']);
    });

    it('shows the summary in the trigger name and does not open a disabled item', () => {
        renderWithProviders(<Accordion type="single" items={items} variant="card" />);

        expect(screen.getByRole('button', { name: /First.*5 min/ })).toBeTruthy();

        const disabled = screen.getByRole('button', { name: /Third/ });
        expect((disabled as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(disabled);
        expect(disabled.getAttribute('aria-expanded')).toBe('false');
    });

    it('is controlled by value', () => {
        const { rerender } = renderWithProviders(
            <Accordion type="single" value="b" items={items} />,
        );
        expect(screen.getByRole('button', { name: /Second/ }).getAttribute('aria-expanded')).toBe('true');

        rerender(<Accordion type="single" value="a" items={items} />);
        expect(screen.getByRole('button', { name: /First/ }).getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('button', { name: /Second/ }).getAttribute('aria-expanded')).toBe('false');
    });

    it('moves focus between triggers with the arrow keys, skipping disabled ones', () => {
        renderWithProviders(<Accordion type="single" items={items} />);

        const first = screen.getByRole('button', { name: /First/ });
        const second = screen.getByRole('button', { name: /Second/ });
        first.focus();

        fireEvent.keyDown(first, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(second);

        fireEvent.keyDown(second, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(first);

        fireEvent.keyDown(first, { key: 'End' });
        expect(document.activeElement).toBe(second);
    });

    it('renders no item for an empty list', () => {
        renderWithProviders(<Accordion type="single" items={[]} />);

        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
});

describe('CollapsibleBlock', () => {
    it('puts the count in the label and opens without changing it', () => {
        renderWithProviders(
            <CollapsibleBlock trigger={{ icon: History, label: 'Rounds', count: 2 }}>
                <p>Round list</p>
            </CollapsibleBlock>,
        );

        const trigger = screen.getByRole('button', { name: 'Rounds (2)' });
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(trigger);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('Round list')).toBeTruthy();
    });

    it('follows a new count while staying closed', () => {
        const { rerender } = renderWithProviders(
            <CollapsibleBlock trigger={{ label: 'Rounds', count: 2 }}>x</CollapsibleBlock>,
        );

        rerender(<CollapsibleBlock trigger={{ label: 'Rounds', count: 3 }}>x</CollapsibleBlock>);

        const trigger = screen.getByRole('button', { name: 'Rounds (3)' });
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('reports open changes in controlled mode', () => {
        const onOpenChange = vi.fn();
        renderWithProviders(
            <CollapsibleBlock open={false} onOpenChange={onOpenChange} trigger={{ label: 'Rounds' }}>
                x
            </CollapsibleBlock>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Rounds' }));
        expect(onOpenChange).toHaveBeenCalledWith(true);
    });
});
