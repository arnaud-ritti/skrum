import { fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    ConfigurationFields,
    SsoProviderDetails,
} from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import SignInSettings from './sign-in';

const page = vi.hoisted(() => ({
    props: { translations: {}, locale: 'en' } as Record<string, unknown>,
    flash: {} as Record<string, unknown>,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
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

const clientFields: ConfigurationFields = {
    client_id: {
        value: 'client',
        source: 'stored',
        secret: false,
        secretSet: false,
        unreadable: false,
        envName: 'CLIENT_ID',
    },
    client_secret: {
        value: null,
        source: 'stored',
        secret: true,
        secretSet: true,
        unreadable: false,
        envName: 'CLIENT_SECRET',
    },
};

function provider(
    key: SsoProviderDetails['key'],
    label: string,
): SsoProviderDetails {
    return {
        key,
        label,
        configured: true,
        redirectUri: `https://retro.atlas.test/auth/${key}/callback`,
        fields: clientFields,
        testable: key === 'oidc' || key === 'entra',
        updateUrl: `/admin/sign-in/providers/${key}`,
        secretChangedAt: null,
    };
}

function setup(confirmedUntil: string | null = '2026-10-03T12:04:00Z') {
    return renderWithProviders(
        <SignInSettings
            ssoRequired={false}
            inForce={false}
            providers={[{ key: 'google', label: 'Google' }]}
            blockers={[]}
            accountsWithoutSso={0}
            adminsWithPasswordWayBack={1}
            providerDetails={[
                provider('google', 'Google'),
                provider('oidc', 'OIDC'),
            ]}
            lastTest={{
                provider: 'oidc',
                at: '2026-10-03T11:00:00Z',
                ok: false,
                ms: 80,
                issuer: null,
            }}
            confirmedUntil={confirmedUntil}
            confirmUrl="/admin/sign-in/confirm"
            defaultWorkspaceId={null}
            defaultWorkspaceOptions={[
                { id: '01990000-0000-7000-8000-000000000001', name: 'Aurora' },
            ]}
        />,
    );
}

function region(name: string): HTMLElement {
    return screen.getByRole('region', { name });
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    page.flash = {};
});

afterEach(() => {
    vi.useRealTimers();
});

describe('SignInSettings page', () => {
    it('draws one card per provider above the "SSO required" form', () => {
        setup();

        expect(region('Google')).not.toBeNull();
        expect(region('OIDC')).not.toBeNull();
        expect(
            screen.getByRole('form', { name: 'SSO authentication' }),
        ).not.toBeNull();
    });

    it('ends with the card of the new SSO accounts, after the "SSO required" form', () => {
        setup();

        const form = screen.getByRole('form', { name: 'SSO authentication' });
        const card = region('New SSO accounts');

        expect(
            form.compareDocumentPosition(card) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(form.contains(card)).toBe(false);
        expect(screen.getAllByRole('region').at(-1)).toBe(card);
    });

    it('gives the topbar to the card being edited and locks the others', () => {
        setup();

        const topbar = screen.getByRole('banner');

        expect(
            topbar.querySelector('button[type=submit]')?.getAttribute('form'),
        ).toBe(screen.getByRole('form', { name: 'SSO authentication' }).id);

        fireEvent.change(within(region('Google')).getByLabelText('Client ID'), {
            target: { value: 'other' },
        });

        expect(
            topbar.querySelector('button[type=submit]')?.getAttribute('form'),
        ).toBe(screen.getByRole('form', { name: 'Google' }).id);
        expect(
            (
                within(region('OIDC')).getByLabelText(
                    'Client ID',
                ) as HTMLInputElement
            ).readOnly,
        ).toBe(true);
    });

    it('asks for a confirmation and makes the fields read-only without one', () => {
        setup(null);

        expect(
            screen.getByText('Confirm your password to change these settings.'),
        ).not.toBeNull();
        expect(
            (
                within(region('Google')).getByLabelText(
                    'Client ID',
                ) as HTMLInputElement
            ).readOnly,
        ).toBe(true);
    });

    it('shows the flashed test result on the card of the provider tested last', () => {
        page.flash = {
            ssoTest: {
                ok: false,
                ms: 80,
                issuer: null,
                error: 'unreachable',
            },
        };

        setup();

        expect(within(region('OIDC')).getByRole('alert').textContent).toContain(
            "The provider's discovery document could not be reached.",
        );
        expect(within(region('Google')).queryByText(/Last test/)).toBeNull();
    });
});
