import { act, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailSettingsPageProps } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import AdminMail from './mail';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Head: () => null,
}));

vi.mock('@/components/admin/admin-shell', () => ({
    AdminShell: ({
        actions,
        children,
    }: {
        actions?: ReactNode;
        children: ReactNode;
    }) => (
        <div>
            <header>{actions}</header>
            {children}
        </div>
    ),
}));

function props(
    overrides: Partial<MailSettingsPageProps> = {},
): MailSettingsPageProps {
    return {
        mail: {
            delivering: true,
            fields: {
                host: {
                    value: 'smtp.atlas.test',
                    source: 'environment',
                    secret: false,
                    secretSet: false,
                    unreadable: false,
                    envName: 'MAIL_HOST',
                },
                password: {
                    value: null,
                    source: 'environment',
                    secret: true,
                    secretSet: true,
                    unreadable: false,
                    envName: 'MAIL_PASSWORD',
                },
            },
        },
        lastTest: null,
        defaultRecipient: 'arnaud@atlas.test',
        confirmedUntil: '2026-10-15T12:04:00Z',
        confirmUrl: '/admin/mail/confirm',
        updateUrl: '/admin/mail',
        ...overrides,
    };
}

function host(): HTMLInputElement {
    return screen.getByLabelText('Host') as HTMLInputElement;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('AdminMail page', () => {
    it('hands the unsaved-changes bar of the SMTP form to the topbar', () => {
        renderWithProviders(<AdminMail {...props()} />);

        fireEvent.change(host(), { target: { value: 'smtp.stored.test' } });

        const bar = screen.getByRole('banner');

        expect(bar.textContent).toContain('1 unsaved change');
        expect(
            bar.querySelector('button[type=submit]')?.getAttribute('form'),
        ).toBe(screen.getByRole('form', { name: 'SMTP' }).id);
    });

    it('asks for the password before the fields can change', () => {
        renderWithProviders(<AdminMail {...props({ confirmedUntil: null })} />);

        expect(
            screen.getByText('Confirm your password to change these settings.'),
        ).not.toBeNull();
        expect(
            screen.getByRole('link', { name: 'Confirm' }).getAttribute('href'),
        ).toBe('/admin/mail/confirm');
        expect(host().readOnly).toBe(true);
    });

    it('asks again once the confirmation passes', () => {
        renderWithProviders(<AdminMail {...props()} />);

        expect(
            screen.queryByText(
                'Confirm your password to change these settings.',
            ),
        ).toBeNull();
        expect(host().readOnly).toBe(false);

        act(() => {
            vi.advanceTimersByTime(4 * 60 * 1000 + 1);
        });

        expect(
            screen.getByText('Confirm your password to change these settings.'),
        ).not.toBeNull();
        expect(host().readOnly).toBe(true);
    });
});
