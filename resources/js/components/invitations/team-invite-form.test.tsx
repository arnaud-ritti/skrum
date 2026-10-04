import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TeamInviteForm } from '@/components/invitations/team-invite-form';
import type { TeamRoleValue } from '@/lib/invitations/types';

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

const Roles: TeamRoleValue[] = ['facilitator', 'member', 'observer'];

function renderForm(props: Partial<Parameters<typeof TeamInviteForm>[0]> = {}) {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
        <TeamInviteForm
            team={{ name: 'Atlas', initial: 'A', color: 'lagoon' }}
            roles={Roles}
            defaultRole="member"
            inviteLink={{
                link: null,
                canManage: true,
                onCreate: vi.fn(),
                onReplace: vi.fn().mockResolvedValue(undefined),
                onTurnOff: vi.fn(),
            }}
            onSubmit={onSubmit}
            {...props}
        />,
    );

    return { onSubmit };
}

function typeAddresses(text: string): void {
    const input = screen.getByLabelText('Emails');

    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter' });
}

function submitButton(): HTMLButtonElement {
    return screen.getByRole('button', { name: /^Send/ });
}

describe('TeamInviteForm', () => {
    it('cannot be sent without an address', () => {
        renderForm();

        expect(submitButton().disabled).toBe(true);
        expect(submitButton().textContent).toBe('Send invitations');
    });

    it('cannot be sent while an address is incomplete', () => {
        renderForm();

        fireEvent.paste(screen.getByLabelText('Emails'), {
            clipboardData: { getData: () => 'a@x.io malik@nordlys' },
        });

        expect(submitButton().disabled).toBe(true);
    });

    it('names the number of invitations it sends', () => {
        renderForm();

        typeAddresses('a@x.io');

        expect(submitButton().textContent).toBe('Send one invitation');

        typeAddresses('b@x.io');
        typeAddresses('c@x.io');

        expect(submitButton().textContent).toBe('Send 3 invitations');
        expect(submitButton().disabled).toBe(false);
    });

    it('sends the addresses, the role and the message, then clears the addresses', async () => {
        const { onSubmit } = renderForm();

        typeAddresses('a@x.io');
        typeAddresses('b@x.io');
        fireEvent.change(screen.getByLabelText('Message · optional'), {
            target: { value: 'Welcome aboard' },
        });

        await act(async () => {
            fireEvent.click(submitButton());
        });

        expect(onSubmit).toHaveBeenCalledWith({
            emails: ['a@x.io', 'b@x.io'],
            role: 'member',
            message: 'Welcome aboard',
        });
        expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    });

    it('keeps the addresses when sending fails', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('invalid'));
        renderForm({ onSubmit });

        typeAddresses('a@x.io');

        await act(async () => {
            fireEvent.click(submitButton());
        });

        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    it('says which role the team gives the people it invites', async () => {
        renderForm();

        expect(screen.getByText('They join Atlas as members.')).toBeTruthy();

        await userEvent.click(screen.getByRole('combobox', { name: 'Role' }));
        await userEvent.click(
            await screen.findByRole('option', { name: 'Observer' }),
        );

        expect(screen.getByText('They join Atlas as observers.')).toBeTruthy();
    });

    it('starts from the given role', () => {
        renderForm({ defaultRole: 'facilitator' });

        expect(
            screen.getByText('They join Atlas as facilitators.'),
        ).toBeTruthy();
    });

    it('offers to skip only when asked', () => {
        const onSkip = vi.fn();

        renderForm({ onSkip });
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('has no skip button by default', () => {
        renderForm();

        expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    });

    it('shows the server errors of the role and the message under their fields', () => {
        renderForm({
            errors: {
                role: 'The selected role is invalid.',
                message: 'The message is too long.',
            },
        });

        expect(screen.getByText('The selected role is invalid.')).toBeTruthy();
        expect(screen.getByText('The message is too long.')).toBeTruthy();
    });

    it('sends an address typed but not yet turned into a chip', async () => {
        const { onSubmit } = renderForm();

        fireEvent.change(screen.getByLabelText('Emails'), {
            target: { value: 'a@x.io' },
        });

        expect(submitButton().textContent).toBe('Send one invitation');

        await act(async () => {
            fireEvent.click(submitButton());
        });

        expect(onSubmit).toHaveBeenCalledWith({
            emails: ['a@x.io'],
            role: 'member',
            message: '',
        });
    });

    it('keeps a server error on the address it was sent for when the chips change', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('invalid'));
        const props = {
            team: { name: 'Atlas', initial: 'A', color: 'lagoon' as const },
            roles: Roles,
            inviteLink: {
                link: null,
                canManage: true,
                onCreate: vi.fn(),
                onReplace: vi.fn().mockResolvedValue(undefined),
                onTurnOff: vi.fn(),
            },
            onSubmit,
        };
        const { rerender } = render(<TeamInviteForm {...props} />);

        typeAddresses('a@x.io');
        typeAddresses('b@x.io');

        await act(async () => {
            fireEvent.click(submitButton());
        });

        rerender(
            <TeamInviteForm
                {...props}
                errors={{
                    'emails.1': 'b@x.io already has a pending invitation.',
                }}
            />,
        );

        expect(
            screen.getByText('b@x.io already has a pending invitation.'),
        ).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Remove a@x.io' }));
        typeAddresses('c@x.io');

        expect(
            screen.getByText('b@x.io already has a pending invitation.'),
        ).toBeTruthy();
        expect(
            screen
                .getAllByRole('listitem')
                .filter((item) => item.getAttribute('aria-invalid') === 'true')
                .map((item) => item.dataset.value),
        ).toEqual(['b@x.io']);
    });
});
