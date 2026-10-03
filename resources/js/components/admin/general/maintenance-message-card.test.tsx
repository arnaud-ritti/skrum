import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { MaintenanceMessageCard } from './maintenance-message-card';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

describe('MaintenanceMessageCard', () => {
    it('names the author and the time of the saved message', () => {
        renderWithProviders(
            <MaintenanceMessageCard
                value="Back soon."
                savedBy={{ name: 'Ada Admin' }}
                savedAt="2026-10-02T14:02:00+00:00"
                onChange={() => {}}
            />,
        );

        expect(
            document.querySelector('[data-slot=maintenance-saved-by]')
                ?.textContent,
        ).toMatch(/^Saved by Ada Admin, Oct 2, 2026/);
    });

    it('clears the message, and has nothing to clear when it is empty', () => {
        const onChange = vi.fn();
        const { rerender } = renderWithProviders(
            <MaintenanceMessageCard
                value="Back soon."
                savedBy={null}
                savedAt={null}
                onChange={onChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

        expect(onChange).toHaveBeenCalledExactlyOnceWith('');

        rerender(
            <MaintenanceMessageCard
                value=""
                savedBy={null}
                savedAt={null}
                onChange={onChange}
            />,
        );

        expect(
            (screen.getByRole('button', { name: 'Clear' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
        expect(
            document.querySelector('[data-slot=maintenance-saved-by]'),
        ).toBeNull();
    });

    it('says in words that the message is too long', () => {
        renderWithProviders(
            <MaintenanceMessageCard
                value={'a'.repeat(300)}
                savedBy={null}
                savedAt={null}
                onChange={() => {}}
            />,
        );

        expect(
            screen.getByText('Keep the message to 280 characters.'),
        ).not.toBeNull();
        expect(
            screen.getByLabelText('Message').getAttribute('aria-invalid'),
        ).toBe('true');
    });
});
