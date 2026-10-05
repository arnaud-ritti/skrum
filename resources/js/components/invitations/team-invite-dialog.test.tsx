import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamInviteDialog } from '@/components/invitations/team-invite-dialog';
import type { InviteLink } from '@/lib/invitations/types';
import { renderWithProviders } from '@/test/render';

type VisitOptions = {
    only?: string[];
    onStart?: () => void;
    onSuccess?: (page: { flash: Record<string, unknown> }) => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    toastSuccess: vi.fn(),
    wide: true,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { post: mocks.post, delete: mocks.delete, reload: mocks.reload },
}));

vi.mock('sonner', () => ({
    toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

vi.mock('@/hooks/use-min-width', () => ({ useMinWidth: () => mocks.wide }));

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.post.mockReset();
    mocks.delete.mockReset();
    mocks.reload.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.wide = true;
});

const link: InviteLink = {
    url: 'https://skrum.test/invite/abc',
    expiresAt: new Date(
        Date.now() + 7 * 24 * 3600 * 1000 - 60_000,
    ).toISOString(),
    usesCount: 3,
};

function renderDialog(
    props: Partial<Parameters<typeof TeamInviteDialog>[0]> = {},
) {
    return renderWithProviders(
        <TeamInviteDialog
            workspaceSlug="nordlys"
            team={{ id: 't1', name: 'Atlas', color: 'lagoon' }}
            roles={['facilitator', 'member', 'observer']}
            inviteLink={link}
            open
            onOpenChange={vi.fn()}
            {...props}
        />,
    );
}

function addAddresses(text: string): void {
    const input = screen.getByLabelText('Emails');

    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter' });
}

describe('TeamInviteDialog', () => {
    it('loads the team link when it opens and shows how many joined', () => {
        renderDialog();

        expect(mocks.reload).toHaveBeenCalledWith({ only: ['inviteLink'] });
        expect(screen.getByRole('dialog').textContent).toContain(
            'Invite to Atlas',
        );
        expect(screen.getByText('Expires in 7 days · 3 joined')).toBeTruthy();
    });

    it('does not offer to create a link while the link loads', () => {
        renderDialog({ inviteLink: undefined });

        expect(
            screen.queryByRole('button', { name: 'Create a link' }),
        ).toBeNull();
    });

    it('creates and turns off the link', async () => {
        const { rerender } = renderDialog({ inviteLink: null });

        await userEvent.click(
            screen.getByRole('button', { name: 'Create a link' }),
        );

        expect(mocks.post).toHaveBeenCalledWith(
            '/w/nordlys/teams/t1/invite-link',
            {},
            expect.objectContaining({ only: ['inviteLink'] }),
        );

        rerender(
            <TeamInviteDialog
                workspaceSlug="nordlys"
                team={{ id: 't1', name: 'Atlas', color: 'lagoon' }}
                roles={['facilitator', 'member', 'observer']}
                inviteLink={link}
                open
                onOpenChange={vi.fn()}
            />,
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Turn off the link' }),
        );
        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Turn off the link',
            }),
        );

        expect(mocks.delete).toHaveBeenCalledWith(
            '/w/nordlys/teams/t1/invite-link',
            expect.objectContaining({ only: ['inviteLink'] }),
        );
    });

    it('sends the invitations, says how many and clears the addresses', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onSuccess?.({ flash: { invitationsSent: 2 } });
                options.onFinish?.();
            },
        );
        renderDialog();

        addAddresses('camille@example.com theo@example.com');
        await userEvent.click(
            screen.getByRole('button', { name: 'Send 2 invitations' }),
        );

        expect(mocks.post).toHaveBeenCalledWith(
            '/w/nordlys/teams/t1/invitations',
            {
                emails: ['camille@example.com', 'theo@example.com'],
                role: 'member',
                message: '',
            },
            expect.objectContaining({ only: ['pendingInvitations'] }),
        );
        expect(mocks.toastSuccess).toHaveBeenCalledWith('2 invitations sent.');
        expect(screen.queryByText('camille@example.com')).toBeNull();
    });

    it('keeps the addresses and shows the error of the chip the server refused', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onError?.({
                    'emails.1': 'theo@example.com is already in Atlas.',
                });
                options.onFinish?.();
            },
        );
        renderDialog();

        addAddresses('camille@example.com theo@example.com');
        await userEvent.click(
            screen.getByRole('button', { name: 'Send 2 invitations' }),
        );

        expect(screen.getByText('camille@example.com')).toBeTruthy();
        expect(
            screen.getByText('theo@example.com is already in Atlas.'),
        ).toBeTruthy();
        expect(mocks.toastSuccess).not.toHaveBeenCalled();
    });

    it('shows the links of the invitations on an instance without mail', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onSuccess?.({
                    flash: {
                        invitationsSent: 1,
                        invitationUrls: ['https://skrum.test/invitations/xyz'],
                    },
                });
                options.onFinish?.();
            },
        );
        renderDialog();

        addAddresses('camille@example.com');
        await userEvent.click(
            screen.getByRole('button', { name: 'Send one invitation' }),
        );

        expect(mocks.toastSuccess).toHaveBeenCalledWith('One invitation sent.');
        expect(
            screen.getByDisplayValue('https://skrum.test/invitations/xyz'),
        ).toBeTruthy();
    });

    it('puts the focus on the link when it is opened for the link', async () => {
        renderDialog({ focusLink: true });

        await act(async () => {});

        expect(document.activeElement).toBe(
            within(
                document.querySelector<HTMLElement>(
                    '[data-slot="invite-link-block"]',
                )!,
            ).getByRole('button', { name: 'Copy' }),
        );
    });

    it('opens as a drawer on a phone', () => {
        mocks.wide = false;
        renderDialog();

        expect(
            document.querySelector('[data-slot="drawer-content"]'),
        ).not.toBeNull();
    });
});
