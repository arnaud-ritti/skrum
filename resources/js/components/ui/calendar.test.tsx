import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Calendar, calendarLocale } from '@/components/ui/calendar';
import { renderWithProviders } from '@/test/render';

describe('Calendar', () => {
    it.each([
        ['es', 'octubre', 'lunes'],
        ['de', 'Oktober', 'Montag'],
    ] as const)(
        'reads the months and starts the week on Monday in %s',
        (locale, month, monday) => {
            renderWithProviders(
                <Calendar
                    mode="single"
                    locale={locale}
                    today={new Date(2026, 9, 14)}
                    defaultMonth={new Date(2026, 9, 1)}
                    onSelect={vi.fn()}
                />,
            );

            expect(screen.getByRole('grid').getAttribute('aria-label')).toContain(
                month,
            );
            expect(
                document.querySelector('thead th')?.getAttribute('aria-label'),
            ).toBe(monday);
        },
    );

    it('falls back to English for a locale it does not know', () => {
        expect(calendarLocale('es')).toBe('es');
        expect(calendarLocale('it')).toBe('en');
        expect(calendarLocale('toString')).toBe('en');
    });
});
