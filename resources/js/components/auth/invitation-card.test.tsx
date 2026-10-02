import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationCard } from '@/components/auth/invitation-card';
import type { InvitationProps } from '@/components/auth/invitation-card';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
    props: {} as Record<string, unknown>,
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { formMock } = await import('@/test/inertia-form');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => page,
        Form: formMock(form),
    };
});

const mona = {
    id: 'user-1',
    name: 'Mona Member',
    email: 'mona@example.com',
    avatarUrl: '/avatars/mona.svg',
};

const pending: InvitationProps = {
    isInvalid: false,
    token: 'secret-token',
    workspaceName: 'Nordlys',
    email: 'mona@example.com',
    isExpired: false,
    isLoggedIn: false,
    emailMatches: false,
    canRegister: true,
    ssoProviders: [],
    inviter: { name: 'Ada Lovelace', avatarUrl: '/avatars/ada.svg' },
    role: 'member',
    expiresAt: '2026-10-09T12:00:00+00:00',
    membersCount: 11,
    members: [
        { name: 'Tom Martin', avatarUrl: '/avatars/tom.svg' },
        { name: 'Ines Lopez', avatarUrl: '/avatars/ines.svg' },
        { name: 'Max Schmidt', avatarUrl: '/avatars/max.svg' },
        { name: 'Zoe Petit', avatarUrl: '/avatars/zoe.svg' },
        { name: 'Yan Roy', avatarUrl: '/avatars/yan.svg' },
    ],
};

function state(): string | null | undefined {
    return document
        .querySelector('[data-slot="invitation-card"]')
        ?.getAttribute('data-state');
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    page.props = { translations: {}, locale: 'en', auth: { user: null } };
    form.processing = false;
    form.errors = {};
    form.props = {};
});

afterEach(() => {
    vi.useRealTimers();
});

describe('InvitationCard', () => {
    it('says an unknown link is no longer valid, and nothing else', () => {
        renderWithProviders(<InvitationCard isInvalid />);

        expect(
            screen.getByRole('heading', { name: 'Invitation' }),
        ).toBeTruthy();
        expect(
            screen.getByText('This invitation link is no longer valid.'),
        ).toBeTruthy();
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
        expect(document.querySelector('[data-slot="invitation-card"]')).toBe(
            null,
        );
    });

    it('names the workspace, the inviter and the last day of an expired invitation', () => {
        renderWithProviders(
            <InvitationCard
                isInvalid={false}
                isExpired
                workspaceName="Nordlys"
                inviter={{ name: 'Ada Lovelace', avatarUrl: '' }}
                expiresAt="2026-09-24T12:00:00+00:00"
            />,
        );

        expect(
            screen.getByRole('heading', {
                name: 'This invitation has expired',
            }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Your invitation to join Nordlys was valid until September 24.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Ask Ada Lovelace for a new link; nothing else to do.',
            ),
        ).toBeTruthy();
        expect(
            document
                .querySelector('[data-slot="access-notice-mark"]')
                ?.classList.contains('bg-skrum-warning-soft'),
        ).toBe(true);
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('gives the year of an invitation that expired another year', () => {
        renderWithProviders(
            <InvitationCard
                {...pending}
                isExpired
                expiresAt="2025-09-24T12:00:00+00:00"
            />,
        );

        expect(
            screen.getByText(
                'Your invitation to join Nordlys was valid until September 24, 2025.',
            ),
        ).toBeTruthy();
    });

    it('does not call a used invitation expired, and asks an administrator when the inviter is gone', () => {
        renderWithProviders(
            <InvitationCard {...pending} isExpired inviter={null} />,
        );

        expect(
            screen.getByRole('heading', { name: 'Invitation' }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Your invitation to join Nordlys has expired or was already used.',
            ),
        ).toBeTruthy();
        expect(screen.queryByText(/was valid until/)).toBeNull();
        expect(
            screen.getByText('Ask an administrator of Nordlys for a new link.'),
        ).toBeTruthy();
    });

    it('names the inviter of a used invitation', () => {
        renderWithProviders(<InvitationCard {...pending} isExpired />);

        expect(
            screen.getByText(
                'Your invitation to join Nordlys has expired or was already used.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Ask Ada Lovelace for a new link; nothing else to do.',
            ),
        ).toBeTruthy();
    });

    it('shows the inviter, the role, the members and the locked e-mail', () => {
        renderWithProviders(<InvitationCard {...pending} />);

        expect(state()).toBe('logged-out');
        expect(
            document.querySelector('[data-slot="invitation-sentence"]')
                ?.textContent,
        ).toBe('Ada Lovelace invited you to join Nordlys');
        expect(
            screen.getByText('11 members · you join as Member'),
        ).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Tom Martin' })).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Max Schmidt' })).toBeTruthy();
        expect(screen.queryByRole('img', { name: 'Zoe Petit' })).toBeNull();
        expect(screen.getByRole('img', { name: '8 more' })).toBeTruthy();

        const email = screen.getByLabelText('Email') as HTMLInputElement;

        expect(email.value).toBe('mona@example.com');
        expect(email.readOnly).toBe(true);
        expect(
            screen.getByText('The invitation was sent to this address.'),
        ).toBeTruthy();
    });

    it('translates the role and counts a single member', () => {
        renderWithProviders(
            <InvitationCard
                {...pending}
                role="admin"
                membersCount={1}
                members={pending.members?.slice(0, 1)}
            />,
        );

        expect(screen.getByText('1 member · you join as Admin')).toBeTruthy();
        expect(screen.queryByRole('img', { name: /more$/ })).toBeNull();
    });

    it('falls back to a plain sentence when the inviter has no account any more', () => {
        renderWithProviders(<InvitationCard {...pending} inviter={null} />);

        expect(
            document.querySelector('[data-slot="invitation-sentence"]')
                ?.textContent,
        ).toBe('You are invited to join Nordlys');
    });

    it('offers the providers, then an account and the login to a logged out visitor', () => {
        renderWithProviders(
            <InvitationCard
                {...pending}
                ssoProviders={[
                    { key: 'google', label: 'Google' },
                    { key: 'github', label: 'GitHub' },
                ]}
            />,
        );

        const links = screen.getAllByRole('link');

        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/auth/google/redirect',
            '/auth/github/redirect',
            '/register',
            '/login',
        ]);
        expect(
            screen.getByRole('link', { name: 'Continue with Google' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Create an account' }),
        ).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('offers only the login when registration is closed', () => {
        renderWithProviders(
            <InvitationCard {...pending} canRegister={false} />,
        );

        expect(
            screen.getAllByRole('link').map((link) => link.textContent),
        ).toEqual(['Log in']);
        expect(screen.queryByText('Already have an account?')).toBeNull();
    });

    it('lets the invited account join, without a provider or a login link', () => {
        page.props = { ...page.props, auth: { user: mona } };

        const { container } = renderWithProviders(
            <InvitationCard
                {...pending}
                isLoggedIn
                emailMatches
                ssoProviders={[{ key: 'google', label: 'Google' }]}
            />,
        );

        expect(state()).toBe('accept');
        expect(screen.getByText('Join Nordlys as Mona Member?')).toBeTruthy();
        expect(screen.getByText('mona@example.com')).toBeTruthy();

        const join = screen.getByRole('button', { name: 'Join Nordlys' });

        expect(join.getAttribute('type')).toBe('submit');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/invitations/secret-token/acceptance',
        );
        expect(container.querySelector('form')?.getAttribute('method')).toBe(
            'post',
        );
        expect(
            screen.getByRole('button', { name: 'Switch account' }),
        ).toBeTruthy();
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByLabelText('Email')).toBeNull();
    });

    it('disables the join button while the acceptance is sent', () => {
        page.props = { ...page.props, auth: { user: mona } };
        form.processing = true;

        renderWithProviders(
            <InvitationCard {...pending} isLoggedIn emailMatches />,
        );

        expect(
            (
                screen.getByRole('button', {
                    name: 'Join Nordlys',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('tells another account to log out, and offers nothing to accept', () => {
        page.props = {
            ...page.props,
            auth: {
                user: {
                    ...mona,
                    name: 'Otto Other',
                    email: 'otto@example.com',
                },
            },
        };

        const { container } = renderWithProviders(
            <InvitationCard {...pending} isLoggedIn />,
        );

        expect(state()).toBe('wrong-account');
        expect(
            screen.getByText(
                'You are logged in with another email address. Log out and sign in as mona@example.com to accept.',
            ),
        ).toBeTruthy();
        expect(screen.getByText('otto@example.com')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^Join/ })).toBeNull();
        expect(container.querySelector('form')).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('keeps the places of the team, the message and the refusal empty until they are given', () => {
        const { unmount } = renderWithProviders(
            <InvitationCard {...pending} />,
        );

        for (const slot of ['team', 'message', 'decline']) {
            expect(
                document.querySelector(`[data-slot="invitation-${slot}"]`),
            ).toBeNull();
        }

        unmount();
        renderWithProviders(
            <InvitationCard
                {...pending}
                team={<span>Atlas</span>}
                message={<span>See you Thursday</span>}
                decline={<button type="button">Decline invitation</button>}
            />,
        );

        expect(
            document.querySelector('[data-slot="invitation-team"]')
                ?.textContent,
        ).toBe('Atlas');
        expect(
            document.querySelector('[data-slot="invitation-message"]')
                ?.textContent,
        ).toBe('See you Thursday');
        expect(
            screen.getByRole('button', { name: 'Decline invitation' }),
        ).toBeTruthy();
    });

    it('offers only the providers, and names the invited address, when single sign-on is required', () => {
        renderWithProviders(
            <InvitationCard
                {...pending}
                canRegister={false}
                ssoRequired
                ssoProviders={[{ key: 'oidc', label: 'Nordlys SSO' }]}
            />,
        );

        expect(state()).toBe('logged-out');
        expect(
            screen.getAllByRole('link').map((link) => link.textContent),
        ).toEqual(['Continue with Nordlys SSO']);
        expect(
            screen.getByText(
                'Use the account whose address is mona@example.com.',
            ),
        ).toBeTruthy();
        expect(document.getElementById('email')).toBeNull();
        expect(
            document.querySelector('[data-slot="auth-separator"]'),
        ).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });
});
