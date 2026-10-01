import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Bold, Italic, Link } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Toggle } from '@/components/ui/toggle';
import {
    ToggleGroup,
    ToggleGroupItem,
    type ToggleOption,
} from '@/components/ui/toggle-group';
import { renderWithProviders } from '@/test/render';

vi.stubGlobal(
    'ResizeObserver',
    class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    },
);

const periods: ToggleOption<'30d' | 'all'>[] = [
    { value: '30d', label: 'Last 30 days' },
    { value: 'all', label: 'All time' },
];

describe('Toggle', () => {
    it('exposes aria-pressed and flips on click', async () => {
        const onPressedChange = vi.fn();
        renderWithProviders(
            <Toggle onPressedChange={onPressedChange}>Hide tasks</Toggle>,
        );

        const button = screen.getByRole('button', { name: 'Hide tasks' });
        expect(button.getAttribute('aria-pressed')).toBe('false');

        await userEvent.click(button);

        expect(onPressedChange).toHaveBeenCalledWith(true);
        expect(button.getAttribute('aria-pressed')).toBe('true');
    });

    it('does not toggle when disabled', async () => {
        const onPressedChange = vi.fn();
        renderWithProviders(
            <Toggle disabled onPressedChange={onPressedChange}>
                Hide tasks
            </Toggle>,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(onPressedChange).not.toHaveBeenCalled();
    });

    it('keeps the aria-label of an icon-only toggle', () => {
        renderWithProviders(<Toggle icon={Bold} aria-label="Bold" />);

        expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy();
    });
});

describe('ToggleGroup single with options', () => {
    function Harness({ onChange }: { onChange?: (v: string) => void }) {
        const [value, setValue] = useState<'30d' | 'all'>('30d');

        return (
            <ToggleGroup
                type="single"
                variant="segmented"
                aria-label="Period"
                options={periods}
                value={value}
                onValueChange={(next) => {
                    setValue(next);
                    onChange?.(next);
                }}
            />
        );
    }

    it('is a labelled radiogroup of radios with aria-checked', () => {
        renderWithProviders(<Harness />);

        expect(screen.getByRole('radiogroup', { name: 'Period' })).toBeTruthy();
        expect(
            screen
                .getByRole('radio', { name: 'Last 30 days' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            screen
                .getByRole('radio', { name: 'All time' })
                .getAttribute('aria-checked'),
        ).toBe('false');
    });

    it('selects on click and never reports an empty value', async () => {
        const onChange = vi.fn();
        renderWithProviders(<Harness onChange={onChange} />);

        await userEvent.click(screen.getByRole('radio', { name: 'All time' }));
        expect(onChange).toHaveBeenLastCalledWith('all');

        await userEvent.click(screen.getByRole('radio', { name: 'All time' }));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(
            screen
                .getByRole('radio', { name: 'All time' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('has one tab stop and moves with the arrow keys', async () => {
        renderWithProviders(<Harness />);

        await userEvent.tab();
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Last 30 days' }),
        );

        await userEvent.keyboard('{ArrowRight}');
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'All time' }),
        );

        await userEvent.keyboard(' ');
        expect(
            screen
                .getByRole('radio', { name: 'All time' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        await userEvent.tab();
        expect(document.activeElement).toBe(document.body);
    });
});

describe('ToggleGroup multiple with options', () => {
    it('is a group of aria-pressed buttons that accumulate', async () => {
        const onChange = vi.fn();
        function Harness() {
            const [value, setValue] = useState<string[]>(['bold']);

            return (
                <ToggleGroup
                    type="multiple"
                    variant="toolbar"
                    iconOnly
                    aria-label="Text formatting"
                    options={[
                        { value: 'bold', label: 'Bold', icon: Bold },
                        { value: 'italic', label: 'Italic', icon: Italic },
                        {
                            value: 'link',
                            label: 'Link',
                            icon: Link,
                            separatorBefore: true,
                        },
                    ]}
                    value={value}
                    onValueChange={(next) => {
                        setValue(next);
                        onChange(next);
                    }}
                />
            );
        }
        renderWithProviders(<Harness />);

        expect(screen.getByRole('group', { name: 'Text formatting' })).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed'),
        ).toBe('true');

        await userEvent.click(screen.getByRole('button', { name: 'Italic' }));

        expect(onChange).toHaveBeenLastCalledWith(['bold', 'italic']);
    });

    it('shows the label of an icon-only item as a tooltip on focus', async () => {
        renderWithProviders(
            <ToggleGroup
                type="single"
                iconOnly
                aria-label="Board view"
                options={[
                    { value: 'grid', label: 'Grid', icon: Bold },
                    { value: 'list', label: 'List', icon: Italic },
                ]}
                value="grid"
                onValueChange={() => {}}
            />,
        );

        await userEvent.tab();

        expect(
            (await screen.findAllByText('Grid')).some(
                (node) => node.getAttribute('data-slot') === 'tooltip-content',
            ),
        ).toBe(true);
    });
});

describe('ToggleGroup disabled', () => {
    it('disables every item, keeps the value and explains why', async () => {
        const onValueChange = vi.fn();
        renderWithProviders(
            <ToggleGroup
                type="single"
                variant="segmented"
                aria-label="Card authors"
                disabledReason="Locked during the Voting phase."
                options={periods}
                value="all"
                onValueChange={onValueChange}
            />,
        );

        const group = screen.getByRole('radiogroup', { name: 'Card authors' });
        expect(group.getAttribute('aria-disabled')).toBe('true');
        expect(group.getAttribute('aria-describedby')).toBe(
            screen.getByText('Locked during the Voting phase.').id,
        );

        const checked = screen.getByRole('radio', { name: 'All time' });
        expect(checked.getAttribute('aria-checked')).toBe('true');
        expect((checked as HTMLButtonElement).disabled).toBe(true);

        await userEvent.click(screen.getByRole('radio', { name: 'Last 30 days' }));
        expect(onValueChange).not.toHaveBeenCalled();
    });

    it('disables a single option only', () => {
        renderWithProviders(
            <ToggleGroup
                type="single"
                aria-label="Period"
                options={[
                    { value: '30d', label: 'Last 30 days' },
                    { value: 'all', label: 'All time', disabled: true },
                ]}
                value="30d"
                onValueChange={() => {}}
            />,
        );

        expect(
            (screen.getByRole('radio', { name: 'All time' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
        expect(
            (screen.getByRole('radio', { name: 'Last 30 days' }) as HTMLButtonElement)
                .disabled,
        ).toBe(false);
    });
});

describe('ToggleGroup children API (existing pages)', () => {
    it('still renders items with data-slot and radio semantics', async () => {
        const onValueChange = vi.fn();
        renderWithProviders(
            <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                value="30d"
                onValueChange={onValueChange}
                aria-label="Period"
            >
                <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
                <ToggleGroupItem value="all">All time</ToggleGroupItem>
            </ToggleGroup>,
        );

        const group = screen.getByRole('radiogroup', { name: 'Period' });
        expect(group.getAttribute('data-slot')).toBe('toggle-group');
        expect(
            screen.getByRole('radio', { name: 'All time' }).getAttribute('data-slot'),
        ).toBe('toggle-group-item');

        await userEvent.click(screen.getByRole('radio', { name: 'All time' }));

        expect(onValueChange).toHaveBeenCalledWith('all');
    });
});
