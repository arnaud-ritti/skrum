import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddMemberDialog } from '@/components/teams/add-member-dialog';
import { renderWithProviders } from '@/test/render';
import type { TeamMember, TeamRoleOption } from '@/types';

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { post: mocks.post },
}));

const olga: TeamMember = {
    id: 'user-20',
    name: 'Olga New',
    email: 'olga.new@example.com',
    avatarUrl: '/avatars/20.svg',
};

const roleOptions: TeamRoleOption[] = [
    { value: 'owner', label: 'Owner' },
    { value: 'facilitator', label: 'Facilitator' },
    { value: 'member', label: 'Member' },
    { value: 'observer', label: 'Observer' },
];

const onOpenChange = vi.fn();

function dialog(props: Partial<Parameters<typeof AddMemberDialog>[0]> = {}) {
    return renderWithProviders(
        <AddMemberDialog
            open
            onOpenChange={onOpenChange}
            workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
            team={{ id: 'team-1', name: 'Atlas' }}
            availableMembers={[olga]}
            roleOptions={roleOptions}
            {...props}
        />,
    );
}

function visit(): VisitOptions {
    return mocks.post.mock.calls[0][2] as VisitOptions;
}

async function pickOlga(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('combobox', { name: 'Member' }));
    await user.click(screen.getByRole('option', { name: /Olga New/ }));
}

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.post.mockReset();
    onOpenChange.mockReset();
});

describe('the dialog that adds a workspace member to a team', () => {
    it('says who joins, and keeps Add disabled until someone is picked', async () => {
        const user = userEvent.setup();
        dialog();

        expect(
            screen.getByRole('dialog', { name: 'Add a member' }).textContent,
        ).toContain('Someone already in Nordlys joins this team.');
        expect(
            screen.getByRole('combobox', { name: 'Member' }).textContent,
        ).toBe('Pick a member');
        expect(
            (screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);

        await pickOlga(user);

        expect(
            (screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement)
                .disabled,
        ).toBe(false);
    });

    it("shows each person's avatar in the picker and on the chosen value", async () => {
        const user = userEvent.setup();
        dialog();
        const picker = screen.getByRole('combobox', { name: 'Member' });

        await user.click(picker);

        const option = screen.getByRole('option', { name: /Olga New/ });

        expect(
            option.querySelector('[data-slot="person-avatar"]'),
        ).not.toBeNull();
        expect(option.textContent).toContain('olga.new@example.com');

        await user.click(option);

        expect(
            picker.querySelector('[data-slot="person-avatar"]'),
        ).not.toBeNull();
        expect(picker.textContent).toContain('Olga New');
        expect(picker.textContent).toContain('olga.new@example.com');
    });

    it('adds the picked member with the chosen role and closes', async () => {
        const user = userEvent.setup();
        dialog();
        const role = screen.getByRole('combobox', { name: 'Role' });

        expect(role.textContent).toBe('Member');

        await pickOlga(user);
        await user.click(role);

        expect(
            screen.getAllByRole('option').map((option) => option.textContent),
        ).toEqual(['Owner', 'Facilitator', 'Member', 'Observer']);

        await user.click(screen.getByRole('option', { name: 'Facilitator' }));
        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/team-1/members',
        );
        expect(mocks.post.mock.calls[0][1]).toEqual({
            user_id: 'user-20',
            role: 'facilitator',
        });
        expect(onOpenChange).not.toHaveBeenCalled();

        act(() => {
            visit().onSuccess?.();
            visit().onFinish?.();
        });

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("shows the server's error under its field and stays open", async () => {
        const user = userEvent.setup();
        dialog();

        await pickOlga(user);
        await user.click(screen.getByRole('button', { name: 'Add' }));
        act(() => {
            visit().onError?.({
                user_id: 'This person is already in the team.',
            });
            visit().onFinish?.();
        });

        const picker = screen.getByRole('combobox', { name: 'Member' });

        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.getByRole('alert').textContent).toBe(
            'This person is already in the team.',
        );
        expect(picker.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(picker.getAttribute('aria-describedby')!)
                ?.textContent,
        ).toBe('This person is already in the team.');
    });

    it('shows a refused role under Role, tied to it', async () => {
        const user = userEvent.setup();
        dialog({ roleOptions: [{ value: 'member', label: 'Member' }] });

        await pickOlga(user);
        await user.click(screen.getByRole('button', { name: 'Add' }));
        act(() => {
            visit().onError?.({ role: 'The selected role is invalid.' });
            visit().onFinish?.();
        });

        const role = screen.getByRole('combobox', { name: 'Role' });

        expect(role.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(role.getAttribute('aria-describedby')!)
                ?.textContent,
        ).toBe('The selected role is invalid.');
    });

    it('gives each dialog its own Role id', () => {
        dialog();
        dialog();

        const ids = [
            ...document.querySelectorAll('[data-slot="select-trigger"]'),
        ].map((trigger) => trigger.id);

        expect(ids).toHaveLength(4);
        expect(new Set(ids).size).toBe(4);
    });

    it('posts no role when the viewer is given no role to choose', async () => {
        const user = userEvent.setup();
        dialog({ roleOptions: [] });

        expect(screen.queryByRole('combobox', { name: 'Role' })).toBeNull();

        await pickOlga(user);
        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(mocks.post.mock.calls[0][1]).toEqual({ user_id: 'user-20' });
    });

    it('closes on Cancel without a request', async () => {
        const user = userEvent.setup();
        dialog();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(mocks.post).not.toHaveBeenCalled();
    });
});
