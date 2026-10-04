import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationCard } from '@/components/auth/invitation-card';
import type { InvitationProps } from '@/components/auth/invitation-card';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const visits = vi.hoisted(() => ({ post: vi.fn(), reload: vi.fn() }));
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
        router: { post: visits.post, reload: visits.reload },
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
    visits.post.mockReset();
    visits.reload.mockReset();
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

    it('names the workspace and the inviter of an expired invitation, from a name alone', () => {
        renderWithProviders(
            <InvitationCard
                isInvalid={false}
                isExpired
                workspaceName="Nordlys"
                inviter={{ name: 'Ada Lovelace' }}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'Invitation' }),
        ).toBeTruthy();
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
        expect(
            document
                .querySelector('[data-slot="access-notice-mark"]')
                ?.classList.contains('bg-skrum-warning-soft'),
        ).toBe(true);
        expect(document.querySelector('img')).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('gives no date of an expired invitation, even when one is passed', () => {
        renderWithProviders(
            <InvitationCard
                {...pending}
                isExpired
                expiresAt="2025-09-24T12:00:00+00:00"
            />,
        );

        expect(screen.queryByText(/was valid until/)).toBeNull();
        expect(screen.queryByText(/2025/)).toBeNull();
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

    it('offers the providers, then the account form and the sign-in link to a logged out visitor', () => {
        const { container } = renderWithProviders(
            <InvitationCard
                {...pending}
                passwordRules="minlength: 12; required: lower;"
                ssoProviders={[
                    { key: 'google', label: 'Google' },
                    { key: 'github', label: 'GitHub' },
                ]}
            />,
        );

        expect(
            screen
                .getAllByRole('link')
                .map((link) => link.getAttribute('href')),
        ).toEqual(['/auth/google/redirect', '/auth/github/redirect', '/login']);
        expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
        expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();

        const accountForm = container.querySelector(
            '[data-slot="invitation-card"] form',
        );

        expect(accountForm?.getAttribute('action')).toBe(
            '/invitations/secret-token/account',
        );
        expect(accountForm?.getAttribute('method')).toBe('post');
        expect(
            screen.getByRole('button', {
                name: 'Create my account and join Nordlys',
            }),
        ).toBeTruthy();

        const name = screen.getByLabelText(/^First and last name/);
        const password = screen.getByLabelText(/^Create a password/);

        expect(name.getAttribute('name')).toBe('name');
        expect(password.getAttribute('name')).toBe('password');
        expect(password.getAttribute('type')).toBe('password');
        expect(password.getAttribute('placeholder')).toBe(
            '12 characters minimum',
        );
        expect(
            container.querySelector('[name="password_confirmation"]'),
        ).toBeNull();
    });

    it('never sends the address: the locked field has no name', () => {
        renderWithProviders(<InvitationCard {...pending} />);

        const email = screen.getByLabelText('Email') as HTMLInputElement;

        expect(email.readOnly).toBe(true);
        expect(email.hasAttribute('name')).toBe(false);
    });

    it('shows what the server refused under the fields', () => {
        form.errors = {
            email: 'The email has already been taken.',
            name: 'The name field is required.',
            password: 'The password field must be at least 12 characters.',
        };

        renderWithProviders(<InvitationCard {...pending} />);

        for (const message of Object.values(form.errors)) {
            expect(screen.getByText(message)).toBeTruthy();
        }

        expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    });

    it('disables the account button while the account is created', () => {
        form.processing = true;

        renderWithProviders(<InvitationCard {...pending} />);

        expect(
            (
                screen.getByRole('button', {
                    name: 'Create my account and join Nordlys',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('offers only the login when registration is closed', () => {
        renderWithProviders(
            <InvitationCard {...pending} canRegister={false} />,
        );

        expect(
            screen.getAllByRole('link').map((link) => link.textContent),
        ).toEqual(['Log in']);
        expect(screen.queryByText('Already have an account?')).toBeNull();
        expect(document.querySelector('form')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
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

    it('starts single sign-on with a link that carries neither a query nor the invitation token', () => {
        renderWithProviders(
            <InvitationCard
                {...pending}
                ssoProviders={[{ key: 'google', label: 'Google' }]}
            />,
        );

        const href = screen
            .getByRole('link', { name: 'Continue with Google' })
            .getAttribute('href');

        expect(href).toBe('/auth/google/redirect');
        expect(href).not.toContain('?');
        expect(href).not.toContain('secret-token');
        expect(
            document.querySelector('[data-slot="auth-separator"]'),
        ).not.toBeNull();
        expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(
            'mona@example.com',
        );
    });

    it('draws no provider and no separator when none is enabled', () => {
        renderWithProviders(<InvitationCard {...pending} />);

        expect(document.querySelector('[data-slot="sso-buttons"]')).toBeNull();
        expect(
            document.querySelector('[data-slot="auth-separator"]'),
        ).toBeNull();
        expect(document.querySelector('a[href^="/auth/"]')).toBeNull();
    });

    it.each([
        ['an invalid link', { isInvalid: true }],
        ['an expired invitation', { isExpired: true }],
        ['the invited account', { isLoggedIn: true, emailMatches: true }],
        ['another account', { isLoggedIn: true, emailMatches: false }],
    ])('offers no provider to %s, whatever the list holds', (_, props) => {
        page.props = { ...page.props, auth: { user: mona } };

        renderWithProviders(
            <InvitationCard
                {...pending}
                {...props}
                ssoProviders={[
                    { key: 'google', label: 'Google' },
                    { key: 'github', label: 'GitHub' },
                ]}
            />,
        );

        expect(document.querySelector('[data-slot="sso-buttons"]')).toBeNull();
        expect(document.querySelector('a[href^="/auth/"]')).toBeNull();
        expect(
            screen.queryByRole('link', { name: /Continue with/ }),
        ).toBeNull();
    });
});

describe('InvitationCard for a team, with a message and Decline', () => {
    type VisitOptions = {
        onStart?: () => void;
        onHttpException?: () => boolean;
        onFinish?: () => void;
    };

    const atlas: InvitationProps = {
        ...pending,
        team: { name: 'Atlas', initial: 'A', color: 'lagoon' },
        teamRole: 'facilitator',
        message: 'Retro for sprint 42 on Thursday.',
        isDeclined: false,
        declineUrl: 'https://skrum.test/invitations/secret-token/decline',
    };

    it('draws nothing of a team, a message or a refusal for a workspace invitation', () => {
        renderWithProviders(<InvitationCard {...pending} />);

        for (const slot of ['team', 'message', 'decline']) {
            expect(
                document.querySelector(`[data-slot="invitation-${slot}"]`),
            ).toBeNull();
        }

        expect(document.querySelector('[data-slot="team-mark"]')).toBeNull();
    });

    it('puts the team mark over the inviter and names the team and the workspace', () => {
        renderWithProviders(<InvitationCard {...atlas} />);

        const mark = document.querySelector(
            '[data-slot="invitation-team"] [data-slot="team-mark"]',
        );

        expect(mark?.textContent).toBe('A');
        expect(mark?.classList.contains('col-lagoon')).toBe(true);
        expect(mark?.getAttribute('aria-hidden')).toBe('true');

        const sentence = document.querySelector(
            '[data-slot="invitation-sentence"]',
        );

        expect(sentence?.textContent).toBe(
            'Ada Lovelace invited you to join the Atlas team in the Nordlys workspace',
        );
        expect(
            Array.from(sentence?.querySelectorAll('b') ?? []).map(
                (bold) => bold.textContent,
            ),
        ).toEqual(['Ada Lovelace', 'Atlas', 'Nordlys']);
    });

    it('names the team without an inviter', () => {
        renderWithProviders(<InvitationCard {...atlas} inviter={null} />);

        expect(
            document.querySelector('[data-slot="invitation-sentence"]')
                ?.textContent,
        ).toBe(
            'You are invited to join the Atlas team in the Nordlys workspace',
        );
    });

    it.each([
        ['owner', 'Owner'],
        ['facilitator', 'Facilitator'],
        ['member', 'Member'],
        ['observer', 'Observer'],
    ] as const)(
        'names the team role %s on the members line',
        (teamRole, label) => {
            renderWithProviders(
                <InvitationCard {...atlas} teamRole={teamRole} />,
            );

            expect(
                screen.getByText(`11 members · you join as ${label}`),
            ).toBeTruthy();
        },
    );

    it('quotes the message as text, markup included', () => {
        renderWithProviders(
            <InvitationCard
                {...atlas}
                message={'See you <b>Thursday</b>\nat 2 pm'}
            />,
        );

        const quote = document.querySelector(
            '[data-slot="invitation-message"] blockquote',
        );

        expect(quote?.textContent).toBe('“See you <b>Thursday</b>\nat 2 pm”');
        expect(quote?.querySelector('b')).toBeNull();
    });

    it('names the team on the account button', () => {
        renderWithProviders(<InvitationCard {...atlas} />);

        expect(
            screen.getByRole('button', {
                name: 'Create my account and join Atlas',
            }),
        ).toBeTruthy();
    });

    it('offers Decline under the account form, with what it does', () => {
        renderWithProviders(<InvitationCard {...atlas} />);

        expect(
            screen.getByRole('button', { name: 'Decline invitation' }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Ada Lovelace will be notified. The link stops working.',
            ),
        ).toBeTruthy();
    });

    it('says only that the link stops working when the inviter is gone', () => {
        renderWithProviders(<InvitationCard {...atlas} inviter={null} />);

        expect(screen.getByText('The link stops working.')).toBeTruthy();
    });

    it('offers Decline when single sign-on is required or registration is closed', () => {
        const { unmount } = renderWithProviders(
            <InvitationCard {...atlas} canRegister={false} ssoRequired />,
        );

        expect(
            screen.getByRole('button', { name: 'Decline invitation' }),
        ).toBeTruthy();

        unmount();
        renderWithProviders(<InvitationCard {...atlas} canRegister={false} />);

        expect(
            screen.getByRole('button', { name: 'Decline invitation' }),
        ).toBeTruthy();
    });

    it('posts the refusal once and shows it busy', () => {
        renderWithProviders(<InvitationCard {...atlas} />);

        const decline = screen.getByRole('button', {
            name: 'Decline invitation',
        }) as HTMLButtonElement;

        fireEvent.click(decline);

        expect(visits.post).toHaveBeenCalledTimes(1);
        expect(visits.post.mock.calls[0][0]).toBe(
            'https://skrum.test/invitations/secret-token/decline',
        );

        act(() => {
            (visits.post.mock.calls[0][2] as VisitOptions).onStart?.();
        });

        expect(decline.disabled).toBe(true);
        expect(decline.getAttribute('aria-busy')).toBe('true');

        fireEvent.click(decline);

        expect(visits.post).toHaveBeenCalledTimes(1);
    });

    it('reloads the page when the invitation can no longer be declined', () => {
        renderWithProviders(<InvitationCard {...atlas} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Decline invitation' }),
        );

        let handled: boolean | undefined;

        act(() => {
            const options = visits.post.mock.calls[0][2] as VisitOptions;

            handled = options.onHttpException?.();
            options.onFinish?.();
        });

        expect(handled).toBe(false);
        expect(visits.reload).toHaveBeenCalledTimes(1);
    });

    it('asks the invited account to join the team, with Decline beside it', () => {
        page.props = { ...page.props, auth: { user: mona } };

        renderWithProviders(
            <InvitationCard {...atlas} isLoggedIn emailMatches />,
        );

        expect(screen.getByText('Join Atlas as Mona Member?')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Join Atlas' })).toBeTruthy();

        const decline = screen.getByRole('button', { name: 'Decline' });

        expect(
            decline.closest('[data-slot="invitation-actions"]'),
        ).not.toBeNull();
        expect(
            screen.getByRole('button', { name: 'Switch account' }),
        ).toBeTruthy();

        fireEvent.click(decline);

        expect(visits.post).toHaveBeenCalledTimes(1);
    });

    it('lets another account decline under the log out button', () => {
        page.props = {
            ...page.props,
            auth: { user: { ...mona, email: 'otto@example.com' } },
        };

        renderWithProviders(<InvitationCard {...atlas} isLoggedIn />);

        expect(
            screen.getByRole('button', { name: 'Decline invitation' }),
        ).toBeTruthy();
    });

    it('says a declined invitation was declined and the inviter told', () => {
        renderWithProviders(
            <InvitationCard
                isInvalid={false}
                isExpired
                isDeclined
                workspaceName="Nordlys"
                inviter={{ name: 'Ada Lovelace' }}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'Invitation declined' }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Ada Lovelace has been notified. You can close this page.',
            ),
        ).toBeTruthy();
        expect(screen.queryByText(/has expired/)).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('says only that the page can be closed when the inviter of a declined invitation is gone', () => {
        renderWithProviders(
            <InvitationCard
                isInvalid={false}
                isExpired
                isDeclined
                workspaceName="Nordlys"
                inviter={null}
            />,
        );

        expect(screen.getByText('You can close this page.')).toBeTruthy();
    });
});
