import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteLinkCard } from '@/components/auth/invite-link-card';
import type { InviteLinkProps } from '@/components/auth/invite-link-card';
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

const usable: InviteLinkProps = {
    isInvalid: false,
    isUsable: true,
    token: 'link-token',
    teamName: 'Atlas',
    team: { name: 'Atlas', initial: 'A', color: 'coral' },
    workspaceName: 'Nordlys',
    inviter: { name: 'Ada Lovelace', avatarUrl: '/avatars/ada.svg' },
    teamRole: 'member',
    membersCount: 4,
    members: [
        { name: 'Tom Martin', avatarUrl: '/avatars/tom.svg' },
        { name: 'Ines Lopez', avatarUrl: '/avatars/ines.svg' },
    ],
    isLoggedIn: false,
    isVerified: false,
    canRegister: true,
    ssoRequired: false,
    ssoProviders: [{ key: 'google', label: 'Google' }],
};

function slot(name: string): Element | null {
    return document.querySelector(`[data-slot="${name}"]`);
}

beforeEach(() => {
    page.props = { translations: {}, locale: 'en', auth: { user: null } };
    form.processing = false;
    form.errors = {};
    form.props = {};
});

describe('InviteLinkCard', () => {
    it('shows the invalid card for an unknown link', () => {
        renderWithProviders(<InviteLinkCard isInvalid />);

        expect(
            screen.getByText('This invitation link is no longer valid.'),
        ).toBeTruthy();
        expect(slot('invite-link-card')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('says a dead link no longer works and whom to ask', () => {
        const view = renderWithProviders(
            <InviteLinkCard
                isInvalid={false}
                isUsable={false}
                teamName="Atlas"
                workspaceName="Nordlys"
                inviter={{ name: 'Ada Lovelace', avatarUrl: '/a.svg' }}
            />,
        );

        expect(screen.getByText('This link no longer works.')).toBeTruthy();
        expect(
            screen.getByText('Ask Ada Lovelace for a new one.'),
        ).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByText(/up to/)).toBeNull();

        view.rerender(
            <InviteLinkCard
                isInvalid={false}
                isUsable={false}
                teamName="Atlas"
                workspaceName="Nordlys"
                inviter={null}
            />,
        );

        expect(
            screen.getByText('Ask a team owner for a new one.'),
        ).toBeTruthy();
    });

    it('offers single sign-on, sign in and registration to a signed-out visitor', () => {
        renderWithProviders(<InviteLinkCard {...usable} />);

        expect(slot('invite-link-card')?.getAttribute('data-state')).toBe(
            'logged-out',
        );
        expect(slot('invitation-sentence')?.textContent).toBe(
            'Ada Lovelace invited you to join the Atlas team in the Nordlys workspace',
        );
        expect(slot('invitation-members')?.textContent).toContain(
            '4 members · you join as Member',
        );
        expect(
            slot('invitation-team')?.querySelector('.col-coral'),
        ).not.toBeNull();
        expect(screen.getByRole('link', { name: /Google/ })).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Sign in' }).getAttribute('href'),
        ).toBe('/login');
        expect(
            screen
                .getByRole('link', { name: 'Create an account' })
                .getAttribute('href'),
        ).toBe('/register');
    });

    it('offers no registration when it is closed, and only single sign-on when it is required', () => {
        const view = renderWithProviders(
            <InviteLinkCard {...usable} canRegister={false} />,
        );

        expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
        expect(
            screen.queryByRole('link', { name: 'Create an account' }),
        ).toBeNull();

        view.rerender(<InviteLinkCard {...usable} ssoRequired />);

        expect(screen.getByRole('link', { name: /Google/ })).toBeTruthy();
        expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
        expect(
            screen.queryByRole('link', { name: 'Create an account' }),
        ).toBeNull();
    });

    it('lets a verified account join the team, or switch account', () => {
        page.props = { ...page.props, auth: { user: mona } };

        renderWithProviders(
            <InviteLinkCard
                {...usable}
                isLoggedIn
                isVerified
                canRegister={false}
                ssoProviders={[]}
            />,
        );

        expect(slot('invite-link-card')?.getAttribute('data-state')).toBe(
            'join',
        );
        expect(screen.getByText('Join Atlas as Mona Member?')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Join Atlas' })).toBeTruthy();
        expect(document.querySelector('form')?.getAttribute('action')).toBe(
            '/invite/link-token/membership',
        );
        expect(
            screen.getByRole('button', { name: 'Switch account' }),
        ).toBeTruthy();
        expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    });

    it('asks an unverified account to verify its address first, with the resend button', () => {
        page.props = { ...page.props, auth: { user: mona } };

        renderWithProviders(
            <InviteLinkCard
                {...usable}
                isLoggedIn
                isVerified={false}
                canRegister={false}
                ssoProviders={[]}
            />,
        );

        expect(
            screen.getByRole('heading', {
                name: 'Verify your address to join Atlas',
            }),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Resend verification email' }),
        ).toBeTruthy();
        expect(document.querySelector('form')?.getAttribute('action')).toBe(
            '/email/verification-notification',
        );
        expect(screen.queryByRole('button', { name: 'Join Atlas' })).toBeNull();
    });
});
