import { router } from '@inertiajs/react';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SsoProviderDetails } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { ProviderCard } from './provider-card';
import type { ProviderCardProps } from './provider-card';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

function oidc(overrides: Partial<SsoProviderDetails> = {}): SsoProviderDetails {
    return {
        key: 'oidc',
        label: 'OIDC',
        configured: true,
        redirectUri: 'https://retro.atlas.test/auth/oidc/callback',
        testable: true,
        updateUrl: '/admin/sign-in/providers/oidc',
        secretChangedAt: null,
        fields: {
            base_url: {
                value: 'https://login.atlas.test/realms/atlas',
                source: 'stored',
                secret: false,
                secretSet: false,
                unreadable: false,
                envName: 'OIDC_BASE_URL',
            },
            client_id: {
                value: 'skrum-prod',
                source: 'environment',
                secret: false,
                secretSet: false,
                unreadable: false,
                envName: 'OIDC_CLIENT_ID',
            },
            client_secret: {
                value: null,
                source: 'stored',
                secret: true,
                secretSet: true,
                unreadable: false,
                envName: 'OIDC_CLIENT_SECRET',
            },
            label: {
                value: 'Atlas',
                source: 'stored',
                secret: false,
                secretSet: false,
                unreadable: false,
                envName: 'OIDC_LABEL',
            },
        },
        ...overrides,
    };
}

function setup(overrides: Partial<ProviderCardProps> = {}) {
    const props: ProviderCardProps = {
        provider: oidc(),
        needsConfirmation: false,
        onConfirmationRefused: vi.fn(),
        lockedBy: null,
        onDirtyChange: vi.fn(),
        lastTest: null,
        testResult: null,
        ...overrides,
    };

    renderWithProviders(<ProviderCard {...props} />);

    return props;
}

function card(): HTMLElement {
    return screen.getByRole('region', { name: 'OIDC' });
}

function secret(): HTMLInputElement {
    return screen.getByLabelText('Client secret') as HTMLInputElement;
}

function clientId(): HTMLInputElement {
    return screen.getByLabelText('Client ID') as HTMLInputElement;
}

function save(): void {
    act(() => {
        fireEvent.submit(screen.getByRole('form', { name: 'OIDC' }));
    });
}

function spyOnVisit() {
    return vi.spyOn(router, 'visit').mockImplementation(() => {});
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('ProviderCard', () => {
    it('shows the provider fields, its status and its redirect URI', () => {
        setup();

        expect(within(card()).getByText('Configured')).not.toBeNull();
        expect(
            (screen.getByLabelText('Issuer URL') as HTMLInputElement).value,
        ).toBe('https://login.atlas.test/realms/atlas');
        expect(clientId().value).toBe('skrum-prod');
        expect(
            (screen.getByLabelText('Button label') as HTMLInputElement).value,
        ).toBe('Atlas');
        expect(
            (screen.getByLabelText(/Redirect URI/) as HTMLInputElement).value,
        ).toBe('https://retro.atlas.test/auth/oidc/callback');
    });

    it('says a provider is not configured, with empty fields to fill', () => {
        setup({
            provider: oidc({
                configured: false,
                fields: {
                    ...oidc().fields,
                    client_id: {
                        ...oidc().fields.client_id,
                        value: null,
                        source: 'none',
                    },
                },
            }),
        });

        expect(within(card()).getByText('Not configured')).not.toBeNull();
        expect(clientId().value).toBe('');
    });

    it('never holds a secret, also after a refused save', () => {
        const visit = spyOnVisit();

        setup();

        expect(secret().value).toBe('');
        expect(secret().placeholder).toBe('••••••••••••••••••');

        fireEvent.change(secret(), { target: { value: 's3cret' } });
        save();
        act(() => {
            visit.mock.calls[0][1]?.onError?.({
                client_secret: 'This value is not accepted.',
            });
        });

        expect(secret().value).toBe('');
    });

    it('sends the changed fields and not a blank secret', () => {
        const visit = spyOnVisit();

        setup();

        fireEvent.change(clientId(), { target: { value: 'skrum-next' } });
        save();

        expect(visit.mock.calls[0][0]).toBe('/admin/sign-in/providers/oidc');
        expect(visit.mock.calls[0][1]?.data).toEqual({
            client_id: 'skrum-next',
        });
    });

    it('sends the fields to return to the environment value', () => {
        const visit = spyOnVisit();

        setup();

        const issuer = screen
            .getByLabelText('Issuer URL')
            .closest('[data-slot=configuration-field]') as HTMLElement;

        fireEvent.click(
            within(issuer).getByRole('button', {
                name: 'Use the environment value',
            }),
        );
        save();

        expect(visit.mock.calls[0][1]?.data).toEqual({ clear: ['base_url'] });
    });

    it('is read-only and cannot be saved without a fresh confirmation', () => {
        setup({ needsConfirmation: true });

        expect(clientId().readOnly).toBe(true);
        expect(secret().readOnly).toBe(true);

        const footerSave = within(card()).getByRole('button', {
            name: 'Save',
        }) as HTMLButtonElement;

        expect(footerSave.disabled).toBe(true);
    });

    it('keeps the typed client id when the server asks for a confirmation', () => {
        const visit = spyOnVisit();
        const props = setup();

        fireEvent.change(clientId(), { target: { value: 'skrum-next' } });
        fireEvent.change(secret(), { target: { value: 's3cret' } });
        save();
        act(() => {
            visit.mock.calls[0][1]?.onError?.({
                confirmation: 'Confirm your password again.',
            });
        });

        expect(clientId().value).toBe('skrum-next');
        expect(secret().value).toBe('');
        expect(props.onConfirmationRefused).toHaveBeenCalledOnce();
    });

    it('reports its unsaved changes and resets them on Cancel', () => {
        const props = setup();

        fireEvent.change(clientId(), { target: { value: 'skrum-next' } });

        expect(props.onDirtyChange).toHaveBeenLastCalledWith(true);

        fireEvent.click(within(card()).getByRole('button', { name: 'Cancel' }));

        expect(clientId().value).toBe('skrum-prod');
        expect(props.onDirtyChange).toHaveBeenLastCalledWith(false);
    });

    it('hands its unsaved-changes bar to the topbar while it is edited', () => {
        const slot = document.createElement('div');

        document.body.appendChild(slot);
        setup({ barSlot: slot });

        expect(slot.querySelector('[data-slot=unsaved-bar]')).toBeNull();

        fireEvent.change(clientId(), { target: { value: 'skrum-next' } });

        expect(slot.textContent).toContain('1 unsaved change');
        expect(
            slot.querySelector('button[type=submit]')?.getAttribute('form'),
        ).toBe(screen.getByRole('form', { name: 'OIDC' }).id);

        slot.remove();
    });

    it('asks to finish the card being edited before editing this one', () => {
        setup({ lockedBy: 'Google' });

        expect(clientId().readOnly).toBe(true);

        fireEvent.focus(clientId());

        expect(
            screen.getByText('Save or cancel the changes to Google first.'),
        ).not.toBeNull();
    });

    it('copies the redirect URI', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);

        Object.assign(navigator, { clipboard: { writeText } });
        setup();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        });

        expect(writeText).toHaveBeenCalledWith(
            'https://retro.atlas.test/auth/oidc/callback',
        );
        expect(screen.getByText('Copied')).not.toBeNull();
    });

    it('tests the saved values of the provider', () => {
        const post = vi.spyOn(router, 'post').mockImplementation(() => {});

        setup();

        fireEvent.click(
            screen.getByRole('button', { name: 'Test the connection' }),
        );

        expect(post).toHaveBeenCalledOnce();
        expect(post.mock.calls[0][0]).toBe('/admin/sign-in/tests');
        expect(post.mock.calls[0][1]).toEqual({ provider: 'oidc' });
    });

    it('cannot test unsaved values', () => {
        setup();

        fireEvent.change(clientId(), { target: { value: 'skrum-next' } });

        expect(
            (
                screen.getByRole('button', {
                    name: 'Test the connection',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            screen.getByText('Save first to test these values.'),
        ).not.toBeNull();
    });

    it('has no test for a provider without a discovery document', () => {
        setup({ provider: oidc({ testable: false }) });

        expect(
            screen.queryByRole('button', { name: 'Test the connection' }),
        ).toBeNull();
    });

    it('says when the secret last changed', () => {
        setup({ provider: oidc({ secretChangedAt: '2026-10-12T08:00:00Z' }) });

        expect(screen.getByText('Secret changed 3 days ago')).not.toBeNull();
    });

    it('says nothing about the secret without a date', () => {
        setup();

        expect(screen.queryByText(/Secret changed/)).toBeNull();
    });

    it('draws the e-mail fallback switch on and locked', () => {
        setup();

        const fallback = screen.getByRole('switch', {
            name: 'Keep sign-in by e-mail as fallback',
        }) as HTMLButtonElement;

        expect(fallback.getAttribute('aria-checked')).toBe('true');
        expect(fallback.disabled).toBe(true);
    });

    it('says every change is recorded and mailed', () => {
        setup();

        expect(
            screen.getByText(
                'Every change is recorded in the audit log and mailed to every instance admin.',
            ),
        ).not.toBeNull();
    });

    it('shows a refusal of the section above the fields', () => {
        const visit = spyOnVisit();

        setup();

        fireEvent.change(clientId(), { target: { value: '' } });
        save();
        act(() => {
            visit.mock.calls[0][1]?.onError?.({
                section: 'Turn off "Require SSO" first.',
            });
        });

        expect(
            screen.getByText('Turn off "Require SSO" first.'),
        ).not.toBeNull();
    });
});
