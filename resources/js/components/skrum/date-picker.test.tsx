import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DatePicker, parseTypedDate } from '@/components/skrum/date-picker';
import type { DateShortcut } from '@/components/skrum/date-picker';
import { Calendar } from '@/components/ui/calendar';

const today = new Date(2026, 9, 14);

function describedText(element: HTMLElement): string {
    const ids = element.getAttribute('aria-describedby')?.split(' ') ?? [];

    return ids
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ');
}

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

function Controlled({
    initial,
    onChange,
    ...props
}: {
    initial?: Date;
    onChange?: (date: Date | undefined) => void;
} & Partial<React.ComponentProps<typeof DatePicker>>) {
    const [value, setValue] = useState<Date | undefined>(initial);

    return (
        <DatePicker
            label="Due date"
            locale="en"
            today={today}
            {...props}
            value={value}
            onValueChange={(next) => {
                setValue(next);
                onChange?.(next);
            }}
        />
    );
}

describe('parseTypedDate', () => {
    it('reads day first in French and month first in English', () => {
        expect(parseTypedDate('03/04/2026', 'fr', today)).toEqual(
            new Date(2026, 3, 3),
        );
        expect(parseTypedDate('03/04/2026', 'en', today)).toEqual(
            new Date(2026, 2, 4),
        );
    });

    it('defaults the year and rejects impossible dates', () => {
        expect(parseTypedDate('16/10', 'fr', today)).toEqual(
            new Date(2026, 9, 16),
        );
        expect(parseTypedDate('31/02/2026', 'fr', today)).toBeNull();
        expect(parseTypedDate('nonsense', 'en', today)).toBeNull();
    });

    it('understands natural language in both languages', () => {
        expect(parseTypedDate('tomorrow', 'en', today)).toEqual(
            new Date(2026, 9, 15),
        );
        expect(parseTypedDate('demain', 'fr', today)).toEqual(
            new Date(2026, 9, 15),
        );
        expect(parseTypedDate('in 2 weeks', 'en', today)).toEqual(
            new Date(2026, 9, 28),
        );
        expect(parseTypedDate('dans 3 jours', 'fr', today)).toEqual(
            new Date(2026, 9, 17),
        );
    });
});

describe('DatePicker', () => {
    it('shows the placeholder when empty and the short date when filled', () => {
        const { rerender } = render(
            <DatePicker
                label="Due date"
                locale="en"
                today={today}
                onValueChange={() => {}}
            />,
        );

        expect(
            screen.getByRole('button', { name: /Due date/ }).textContent,
        ).toContain('Pick a date');

        rerender(
            <DatePicker
                label="Due date"
                locale="en"
                today={today}
                value={new Date(2026, 9, 16)}
                onValueChange={() => {}}
            />,
        );

        expect(
            screen.getByRole('button', { name: /Due date/ }).textContent,
        ).toContain('Fri, Oct 16');
    });

    it('formats the date in French and adds the year outside the current year', () => {
        render(
            <DatePicker
                label="Échéance"
                locale="fr"
                today={today}
                value={new Date(2027, 0, 8)}
                onValueChange={() => {}}
            />,
        );

        expect(
            screen.getByRole('button', { name: /Échéance/ }).textContent,
        ).toMatch(/ven\. 8 janv\. 2027/);
    });

    it('opens a dialog, selects a day and closes', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Controlled onChange={onChange} />);

        const trigger = screen.getByRole('button', { name: /Due date/ });
        expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        await user.click(trigger);

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(trigger.getAttribute('aria-expanded')).toBe('true');

        await user.click(
            screen.getByRole('button', { name: 'Friday, October 16' }),
        );

        expect(onChange).toHaveBeenCalledWith(expect.any(Date));
        expect(onChange.mock.calls[0][0].getDate()).toBe(16);
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(trigger.textContent).toContain('Fri, Oct 16');
    });

    it('closes on Escape and gives focus back to the trigger', async () => {
        const user = userEvent.setup();
        render(<Controlled />);

        const trigger = screen.getByRole('button', { name: /Due date/ });
        await user.click(trigger);
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('applies a shortcut, marks the active one and clears with a null date', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const shortcuts: DateShortcut[] = [
            { label: 'Tomorrow', date: new Date(2026, 9, 15) },
            { label: 'No date', date: null },
        ];
        render(
            <Controlled
                initial={new Date(2026, 9, 15)}
                shortcuts={shortcuts}
                onChange={onChange}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Due date/ }));

        expect(
            screen
                .getByRole('button', { name: /Tomorrow/ })
                .getAttribute('data-active'),
        ).toBe('true');

        await user.click(screen.getByRole('button', { name: /No date/ }));

        expect(onChange).toHaveBeenCalledWith(undefined);
        expect(
            screen.getByRole('button', { name: /Due date/ }).textContent,
        ).toContain('Pick a date');
    });

    it('updates a shortcut date without closing the popover', async () => {
        const user = userEvent.setup();
        const props = {
            label: 'Due date',
            locale: 'en' as const,
            today,
            onValueChange: () => {},
        };
        const { rerender } = render(
            <DatePicker
                {...props}
                shortcuts={[
                    { label: 'End of sprint', date: new Date(2026, 9, 20) },
                ]}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Due date/ }));
        expect(screen.getByText('Tue, Oct 20')).toBeTruthy();

        rerender(
            <DatePicker
                {...props}
                shortcuts={[
                    { label: 'End of sprint', date: new Date(2026, 9, 22) },
                ]}
            />,
        );

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByText('Thu, Oct 22')).toBeTruthy();
    });

    it('commits a typed date on Enter and reports the interpretation', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Controlled allowTyping onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: /Due date/ }));
        const input = screen.getByRole('textbox', { name: 'Type a date' });

        expect(input.getAttribute('placeholder')).toBe('MM/DD/YYYY');

        await user.type(input, 'tomorrow');

        expect(describedText(input)).toMatch(
            /Read as Thursday, October 15, 2026/,
        );

        await user.type(input, '{Enter}');

        expect(onChange.mock.calls[0][0].getDate()).toBe(15);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('rejects an invalid typed date and keeps the popover open', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Controlled allowTyping onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: /Due date/ }));
        const input = screen.getByRole('textbox', { name: 'Type a date' });
        await user.type(input, '99/99{Enter}');

        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(describedText(input)).toMatch('Not a valid date');
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('flags an overdue date with text and an icon, not colour alone', () => {
        render(
            <DatePicker
                label="Due date"
                locale="en"
                today={today}
                value={new Date(2026, 9, 12)}
                overdue
                onValueChange={() => {}}
            />,
        );

        const trigger = screen.getByRole('button', { name: /Due date/ });

        expect(screen.getByText('Overdue by 2 days')).toBeTruthy();
        expect(describedText(trigger)).toMatch('Overdue by 2 days');
        expect(trigger.querySelector('svg')?.getAttribute('class')).toContain(
            'lucide-calendar-x',
        );
    });

    it('shows the error message and marks the trigger invalid', () => {
        render(
            <DatePicker
                label="Due date"
                locale="en"
                today={today}
                error="Pick a date"
                onValueChange={() => {}}
            />,
        );

        const trigger = screen.getByRole('button', { name: /Due date/ });

        expect(trigger.getAttribute('aria-invalid')).toBe('true');
        expect(describedText(trigger)).toMatch('Pick a date');
    });

    it('does not open when disabled', async () => {
        const user = userEvent.setup();
        render(
            <DatePicker
                label="Due date"
                locale="en"
                today={today}
                disabled
                onValueChange={() => {}}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Due date/ }));

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('disables unavailable days instead of hiding them', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <Controlled
                isDateDisabled={(date) =>
                    date.getDay() === 0 || date.getDay() === 6
                }
                onChange={onChange}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Due date/ }));
        const saturday = screen.getByRole('button', {
            name: 'Saturday, October 17',
        });

        expect((saturday as HTMLButtonElement).disabled).toBe(true);
        expect(saturday.getAttribute('aria-disabled')).toBe('true');

        await user.click(saturday);

        expect(onChange).not.toHaveBeenCalled();
    });

    it('flashes the trigger when the value changes from outside, not on local picks', () => {
        const props = {
            label: 'Due date',
            locale: 'en' as const,
            today,
            onValueChange: () => {},
        };
        const { rerender } = render(
            <DatePicker {...props} value={new Date(2026, 9, 16)} />,
        );
        const trigger = screen.getByRole('button', { name: /Due date/ });

        expect(trigger.className).not.toContain('bg-skrum-primary-soft');

        rerender(<DatePicker {...props} value={new Date(2026, 9, 21)} />);

        expect(trigger.className).toContain('bg-skrum-primary-soft');
        expect(trigger.textContent).toContain('Wed, Oct 21');
    });
});

describe('Calendar', () => {
    it('exposes a grid of gridcells with full labels, today and selection', () => {
        render(
            <Calendar
                mode="single"
                locale="en"
                today={today}
                selected={new Date(2026, 9, 16)}
                onSelect={() => {}}
            />,
        );

        const grid = screen.getByRole('grid');
        const selectedCell = within(grid)
            .getByRole('button', { name: 'Friday, October 16' })
            .closest('[role="gridcell"]');

        expect(selectedCell?.getAttribute('aria-selected')).toBe('true');
        expect(
            within(grid)
                .getByRole('button', { name: 'Wednesday, October 14' })
                .getAttribute('aria-current'),
        ).toBe('date');
    });

    it('labels days in French and starts the week on Monday', () => {
        render(
            <Calendar
                mode="single"
                locale="fr"
                today={today}
                selected={undefined}
                onSelect={() => {}}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'vendredi 16 octobre' }),
        ).toBeTruthy();
        expect(document.querySelector('th')?.textContent).toMatch(/^lu/i);
    });

    it('honours weekStartsOn over the locale default', () => {
        render(
            <Calendar
                mode="single"
                locale="en"
                weekStartsOn={1}
                today={today}
                onSelect={() => {}}
            />,
        );

        expect(document.querySelector('th')?.textContent).toMatch(/^mo/i);
    });

    it('moves focus by day and week with the arrow keys', async () => {
        const user = userEvent.setup();
        render(
            <Calendar
                mode="single"
                locale="en"
                today={today}
                selected={new Date(2026, 9, 14)}
                onSelect={() => {}}
            />,
        );

        const start = screen.getByRole('button', {
            name: 'Wednesday, October 14',
        });
        start.focus();
        await user.keyboard('{ArrowRight}');

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Thursday, October 15' }),
        );

        await user.keyboard('{ArrowDown}');

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Thursday, October 22' }),
        );
    });

    it('navigates months from the labelled arrows', async () => {
        const user = userEvent.setup();
        render(
            <Calendar
                mode="single"
                locale="en"
                today={today}
                onSelect={() => {}}
            />,
        );

        expect(screen.getByText('October 2026')).toBeTruthy();

        await user.click(screen.getByRole('button', { name: 'Next month' }));

        expect(screen.getByText('November 2026')).toBeTruthy();

        await user.click(
            screen.getByRole('button', { name: 'Previous month' }),
        );
        await user.click(
            screen.getByRole('button', { name: 'Previous month' }),
        );

        expect(screen.getByText('September 2026')).toBeTruthy();
    });

    it('selects a range from two clicks', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(
            <Calendar
                mode="range"
                locale="en"
                today={today}
                onSelect={onSelect}
            />,
        );

        await user.click(
            screen.getByRole('button', { name: 'Monday, October 12' }),
        );

        expect(onSelect).toHaveBeenLastCalledWith(
            expect.objectContaining({ from: expect.any(Date) }),
        );
    });
});
