import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamMembersCard } from '@/components/teams/team-members-card';
import { renderWithProviders } from '@/test/render';
import type { TeamMember } from '@/types';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    on: vi.fn(() => () => {}),
    replace: vi.fn(),
    request: vi.fn(),
    toastError: vi.fn(),
    props: {
        translations: {},
        locale: 'en',
        errors: {} as Record<string, string>,
        currentWorkspace: { role: 'admin' } as { role: string } | null,
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
        }) => (
            <a href={typeof href === 'string' ? href : href.url} {...props}>
                {children}
            </a>
        ),
        router: {
            post: mocks.post,
            patch: mocks.patch,
            delete: mocks.delete,
            reload: mocks.reload,
            on: mocks.on,
            replace: mocks.replace,
        },
    };
});

function member(name: string, index: number): TeamMember {
    return {
        id: `user-${index}`,
        name,
        email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
        avatarUrl: `/avatars/${index}.svg`,
    };
}

const members = [
    'Arnaud Ritti',
    'Camille Roux',
    'Theo Martin',
    'Ines Benali',
    'Malik Kone',
    'Sofia Lindqvist',
    'Noa Kim',
    'Zed Last',
].map(member);

function card(props: Partial<Parameters<typeof TeamMembersCard>[0]> = {}) {
    return renderWithProviders(
        <TeamMembersCard
            workspaceSlug="nordlys"
            team={{ id: 'team-1', name: 'Atlas' }}
            members={members}
            availableMembers={[member('Olga New', 20)]}
            canManage
            {...props}
        />,
    );
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
    mocks.delete.mockReset();
    mocks.props.errors = {};
});

describe('the members card of a team', () => {
    it('counts everyone and shows the first six until asked for more', async () => {
        const user = userEvent.setup();
        card();

        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
            'Members8',
        );
        expect(screen.getAllByRole('listitem')).toHaveLength(6);
        expect(screen.queryByText('Zed Last')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Show 2 more' }));

        expect(screen.getAllByRole('listitem')).toHaveLength(8);
        expect(screen.getByText('zed.last@example.com')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Show/ })).toBeNull();
    });

    it('gives a member no control and leaves the invite and role places empty', () => {
        card({ canManage: false, availableMembers: [] });

        expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.queryByText('Invite')).toBeNull();
        expect(screen.queryByText('Facilitator')).toBeNull();
    });

    it('shows the role badges of a manager without a Remove button, removing stays in the team settings', () => {
        card({
            roleBadgeFor: (member) =>
                member.id === 'user-1' ? <span>Facilitator</span> : null,
        });

        expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
        expect(screen.getByText('Facilitator')).toBeTruthy();
    });

    it('keeps Add disabled until someone is picked and shows the server error under the form', () => {
        mocks.props.errors = { user_id: 'This person is already in the team.' };

        card();

        expect(
            (screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
        expect(screen.getByRole('alert').textContent).toBe(
            'This person is already in the team.',
        );
        expect(
            screen.getByRole('combobox', { name: 'Add a member' }),
        ).toBeTruthy();
    });

    it('adds the chosen person with the role picked in "Add as", Member by default', async () => {
        const user = userEvent.setup();
        const roleOptions = [
            { value: 'owner', label: 'Owner' },
            { value: 'facilitator', label: 'Facilitator' },
            { value: 'member', label: 'Member' },
            { value: 'observer', label: 'Observer' },
        ] as const;

        card({ roleOptions: [...roleOptions] });
        const role = screen.getByRole('combobox', { name: 'Add as' });

        expect(role.textContent).toBe('Member');

        await user.click(
            screen.getByRole('combobox', { name: 'Add a member' }),
        );
        await user.click(screen.getByRole('option', { name: 'Olga New' }));
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
    });

    it('shows a refused role under the form, tied to "Add as"', () => {
        mocks.props.errors = { role: 'The selected role is invalid.' };

        card({ roleOptions: [{ value: 'member', label: 'Member' }] });

        const role = screen.getByRole('combobox', { name: 'Add as' });

        expect(role.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(role.getAttribute('aria-describedby')!)
                ?.textContent,
        ).toBe('The selected role is invalid.');
    });

    it('gives each card its own "Add as" id', () => {
        card({ roleOptions: [{ value: 'member', label: 'Member' }] });
        card({ roleOptions: [{ value: 'member', label: 'Member' }] });

        const [first, second] = screen.getAllByRole('combobox', {
            name: 'Add as',
        });

        expect(first.id).not.toBe(second.id);
    });

    it('posts no role when the viewer is given no role to choose', async () => {
        const user = userEvent.setup();
        card();

        expect(screen.queryByRole('combobox', { name: 'Add as' })).toBeNull();

        await user.click(
            screen.getByRole('combobox', { name: 'Add a member' }),
        );
        await user.click(screen.getByRole('option', { name: 'Olga New' }));
        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(mocks.post.mock.calls[0][1]).toEqual({ user_id: 'user-20' });
    });

    it('has no add form when nobody is left to add', () => {
        card({ availableMembers: [] });

        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    });
});
