import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    InviteDialog,
    InviteMessageField,
    InviteTeamFields,
} from '@/components/workspaces/invite-form';
import { renderWithProviders } from '@/test/render';

type VisitOptions = {
    onSuccess: () => void;
    onError: (errors: Record<string, string>) => void;
    onFinish: () => void;
};

const mocks = vi.hoisted(() => ({ post: vi.fn(), toastSuccess: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router: { post: mocks.post },
}));

vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess } }));

function open(slots = {}) {
    const onOpenChange = vi.fn();

    renderWithProviders(
        <InviteDialog
            open
            onOpenChange={onOpenChange}
            workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
            validForDays={7}
            slots={slots}
        />,
    );

    return { onOpenChange, dialog: screen.getByRole('dialog') };
}

function openWithTeamFields() {
    return open({
        inviteTeamsField: (
            <InviteTeamFields
                teams={[
                    { id: 't1', name: 'Atlas' },
                    { id: 't2', name: 'Boreal' },
                ]}
                teamRoles={['facilitator', 'member', 'observer']}
            />
        ),
        inviteMessageField: <InviteMessageField />,
    });
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.post.mockReset();
    mocks.toastSuccess.mockReset();
});

describe('InviteDialog', () => {
    it('keeps the fields and the submit of the old form', () => {
        const { dialog } = open();
        const email = within(dialog).getByLabelText(
            'Email address',
        ) as HTMLInputElement;

        expect(
            within(dialog).getByRole('heading', { name: 'Invite people' }),
        ).toBeTruthy();
        expect(email.name).toBe('email');
        expect(email.type).toBe('email');
        expect(email.required).toBe(true);
        expect(
            within(dialog).getByRole('combobox', { name: 'Role' }).textContent,
        ).toBe('Member');
        expect(
            within(dialog).getByRole('button', { name: 'Send invitation' }),
        ).toBeTruthy();
        expect(dialog.textContent).toContain(
            'They receive a link to join Nordlys, valid for 7 days.',
        );
    });

    it('says a link valid for one day in the singular', () => {
        renderWithProviders(
            <InviteDialog
                open
                onOpenChange={vi.fn()}
                workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
                validForDays={1}
                slots={{}}
            />,
        );

        expect(screen.getByRole('dialog').textContent).toContain(
            'They receive a link to join Nordlys, valid for 1 day.',
        );
    });

    it('posts the address with the role "member" by default, says so and closes', async () => {
        const { dialog, onOpenChange } = open();

        await userEvent.type(
            within(dialog).getByLabelText('Email address'),
            'lucas@example.com',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Send invitation' }),
        );

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post.mock.calls[0][0]).toBe('/w/nordlys/invitations');
        expect(mocks.post.mock.calls[0][1]).toEqual({
            email: 'lucas@example.com',
            role: 'member',
        });

        await act(async () => {
            (mocks.post.mock.calls[0][2] as VisitOptions).onSuccess();
        });

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
            'Invitation created for lucas@example.com.',
        );
    });

    it('shows the refusal of the server and stays open', async () => {
        const { dialog, onOpenChange } = open();

        await userEvent.type(
            within(dialog).getByLabelText('Email address'),
            'camille@example.com',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Send invitation' }),
        );
        await act(async () => {
            (mocks.post.mock.calls[0][2] as VisitOptions).onError({
                email: 'This person is already a member of the workspace.',
            });
        });

        await waitFor(() =>
            expect(within(dialog).getByRole('alert').textContent).toBe(
                'This person is already a member of the workspace.',
            ),
        );
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
        expect(mocks.toastSuccess).not.toHaveBeenCalled();
    });

    it('renders the later fields in their places, after the role', () => {
        const { dialog } = open({
            inviteTeamsField: <p data-slot="teams-place">teams</p>,
            inviteMessageField: <p data-slot="message-place">message</p>,
        });
        const role = within(dialog).getByRole('combobox', { name: 'Role' });
        const teams = dialog.querySelector('[data-slot="teams-place"]');
        const message = dialog.querySelector('[data-slot="message-place"]');

        expect(teams).not.toBeNull();
        expect(message).not.toBeNull();
        expect(
            role.compareDocumentPosition(teams as Node) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
            (teams as Node).compareDocumentPosition(message as Node) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('offers no team by default and asks the team role only once a team is picked', async () => {
        const { dialog } = openWithTeamFields();
        const team = within(dialog).getByRole('combobox', {
            name: 'Team · optional',
        });

        expect(team.textContent).toBe('No team');
        expect(
            within(dialog).queryByRole('combobox', {
                name: 'Role in the team',
            }),
        ).toBeNull();

        await userEvent.click(team);
        await userEvent.click(screen.getByRole('option', { name: 'Atlas' }));

        expect(
            within(dialog).getByRole('combobox', { name: 'Role in the team' })
                .textContent,
        ).toBe('Member');

        await userEvent.click(team);
        await userEvent.click(screen.getByRole('option', { name: 'No team' }));

        expect(
            within(dialog).queryByRole('combobox', {
                name: 'Role in the team',
            }),
        ).toBeNull();
    });

    it('posts the team, its role and the message with the address', async () => {
        const { dialog } = openWithTeamFields();

        await userEvent.type(
            within(dialog).getByLabelText('Email address'),
            'nadia@example.com',
        );
        await userEvent.click(
            within(dialog).getByRole('combobox', { name: 'Team · optional' }),
        );
        await userEvent.click(screen.getByRole('option', { name: 'Boreal' }));
        await userEvent.click(
            within(dialog).getByRole('combobox', { name: 'Role in the team' }),
        );
        await userEvent.click(
            screen.getByRole('option', { name: 'Facilitator' }),
        );
        await userEvent.type(
            within(dialog).getByLabelText('Message · optional'),
            'Welcome aboard',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Send invitation' }),
        );

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post.mock.calls[0][1]).toEqual({
            email: 'nadia@example.com',
            role: 'member',
            team_id: 't2',
            team_role: 'facilitator',
            message: 'Welcome aboard',
        });
    });

    it('sends no team and no message when none is given', async () => {
        const { dialog } = openWithTeamFields();

        await userEvent.type(
            within(dialog).getByLabelText('Email address'),
            'nadia@example.com',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Send invitation' }),
        );

        expect(mocks.post.mock.calls[0][1]).toEqual({
            email: 'nadia@example.com',
            role: 'member',
        });
    });

    it('counts the message against its 500 characters', async () => {
        const { dialog } = openWithTeamFields();
        const message = within(dialog).getByLabelText(
            'Message · optional',
        ) as HTMLTextAreaElement;

        await userEvent.type(message, 'Hello');

        expect(message.name).toBe('message');
        expect(
            dialog.querySelector('[data-slot="field-counter"]')?.textContent,
        ).toBe('5/500');
    });
});
