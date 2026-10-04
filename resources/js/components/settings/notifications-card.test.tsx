import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { NotificationsCard } from './notifications-card';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const form = vi.hoisted(() => ({
    initial: undefined as Record<string, boolean> | undefined,
    processing: false,
    errors: {} as Record<string, string>,
    submit: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { useState } = await import('react');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => page,
        useForm: (initial: Record<string, boolean>) => {
            const [data, setState] = useState(initial);
            form.initial = initial;

            return {
                data,
                setData: (key: string, value: boolean) =>
                    setState((current) => ({ ...current, [key]: value })),
                processing: form.processing,
                errors: form.errors,
                submit: (...parameters: unknown[]) =>
                    form.submit(data, ...parameters),
            };
        },
    };
});

const preferences = {
    action_item_reminders_by_email: true,
    action_item_reminders_in_app: false,
    recap_emails: true,
    recap_in_app: false,
};

beforeEach(() => {
    page.props = { translations: {} };
    form.processing = false;
    form.errors = {};
    form.submit.mockReset();
});

function card(remindersEnabled = true) {
    return renderWithProviders(
        <NotificationsCard
            preferences={preferences}
            reminderTime="08:00"
            reminderTimezone="UTC"
            remindersEnabled={remindersEnabled}
        />,
    );
}

describe('NotificationsCard', () => {
    it('is the Notifications region with the sentence of the mockup', () => {
        card();

        expect(
            screen.getByRole('region', { name: 'Notifications' }).textContent,
        ).toContain('Choose what reaches you, and where.');
    });

    it('is a table of events with an In-app and an Email column', () => {
        card();

        expect(
            screen
                .getAllByRole('columnheader')
                .map((header) => header.textContent),
        ).toEqual(['Event', 'In-app', 'Email']);
    });

    it('has the two events that exist, the reminders with the time they are sent', () => {
        card();

        const rows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole(
            'row',
        );

        expect(rows.length).toBe(2);
        expect(within(rows[0]).getByRole('rowheader').textContent).toBe(
            'Action item remindersReminders are sent at 08:00 (UTC) for action items assigned to you.',
        );
        expect(within(rows[1]).getByRole('rowheader').textContent).toBe(
            'Retro recap',
        );
    });

    it('has a row for the retro recap with its two switches, in-app first', () => {
        card();

        const inApp = screen.getByRole('switch', {
            name: 'Show retro recaps in the notification bell',
        });
        const email = screen.getByRole('switch', {
            name: 'Email me the results of retrospectives',
        });

        expect(inApp.id).toBe('recap-in-app');
        expect(inApp.getAttribute('aria-checked')).toBe('false');
        expect(email.id).toBe('recap-emails');
        expect(email.getAttribute('aria-checked')).toBe('true');
        expect(
            inApp.compareDocumentPosition(email) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('keeps the ids of the old checkboxes on two switches named by the old labels', () => {
        card();

        const inApp = screen.getByRole('switch', {
            name: 'Show due and overdue action items in the notification bell',
        });
        const email = screen.getByRole('switch', {
            name: 'Email me about due and overdue action items',
        });

        expect(inApp.id).toBe('action-item-reminders-in-app');
        expect(inApp.getAttribute('aria-checked')).toBe('false');
        expect(email.id).toBe('action-item-reminders-by-email');
        expect(email.getAttribute('aria-checked')).toBe('true');
        expect(
            inApp.compareDocumentPosition(email) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('saves nothing until "Save" is pressed, then sends the four preferences', () => {
        card();

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Show due and overdue action items in the notification bell',
            }),
        );
        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Email me about due and overdue action items',
            }),
        );
        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Email me the results of retrospectives',
            }),
        );
        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Show retro recaps in the notification bell',
            }),
        );

        expect(form.submit).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(form.submit).toHaveBeenCalledTimes(1);

        const [data, route, options] = form.submit.mock.calls[0];

        expect(data).toEqual({
            action_item_reminders_by_email: false,
            action_item_reminders_in_app: true,
            recap_emails: false,
            recap_in_app: true,
        });
        expect(route).toMatchObject({
            url: '/settings/notifications',
            method: 'patch',
        });
        expect(options).toEqual({ preserveScroll: true });
    });

    it('disables Save while the preferences are sent', () => {
        form.processing = true;
        card();

        expect(
            (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('says when the instance sends no reminders, and leaves the switches usable', () => {
        card(false);

        expect(
            screen.getByText('Reminders are turned off on this instance.'),
        ).toBeTruthy();
        expect(
            screen
                .getAllByRole('switch')
                .every((control) => !(control as HTMLButtonElement).disabled),
        ).toBe(true);
    });

    it('says nothing about the instance while reminders are on', () => {
        card();

        expect(
            screen.queryByText('Reminders are turned off on this instance.'),
        ).toBeNull();
    });

    it('shows why the preferences were refused', () => {
        form.errors = {
            recap_emails: 'The recap emails field must be true or false.',
        };

        card();

        expect(screen.getByRole('alert').textContent).toBe(
            'The recap emails field must be true or false.',
        );
    });
});
