import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

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

    it('asks before removing a member: Cancel keeps, Remove deletes', async () => {
        const user = userEvent.setup();
        mocks.delete.mockImplementation((_url: string, options: VisitOptions) =>
            options.onFinish?.(),
        );

        card();

        await user.click(
            screen.getByRole('button', { name: 'Remove Camille Roux' }),
        );

        const dialog = screen.getByRole('alertdialog');

        expect(
            within(dialog).getByText('Remove Camille Roux from Atlas?'),
        ).toBeTruthy();

        await user.click(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        );

        expect(mocks.delete).not.toHaveBeenCalled();
        expect(screen.queryByRole('alertdialog')).toBeNull();

        await user.click(
            screen.getByRole('button', { name: 'Remove Camille Roux' }),
        );
        await user.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Remove from team',
            }),
        );
        await act(async () => {});

        expect(mocks.delete).toHaveBeenCalledTimes(1);
        expect(mocks.delete.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/team-1/members/user-1',
        );
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('moves the focus to the heading of the card once a member is removed', async () => {
        const user = userEvent.setup();
        let visit: VisitOptions = {};
        mocks.delete.mockImplementation(
            (_url: string, options: VisitOptions) => {
                visit = options;
            },
        );

        const { rerender } = card();

        await user.click(
            screen.getByRole('button', { name: 'Remove Camille Roux' }),
        );
        await user.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Remove from team',
            }),
        );

        rerender(
            <TeamMembersCard
                workspaceSlug="nordlys"
                team={{ id: 'team-1', name: 'Atlas' }}
                members={members.filter(({ id }) => id !== 'user-1')}
                availableMembers={[]}
                canManage
            />,
        );
        await act(async () => {
            visit.onSuccess?.();
            visit.onFinish?.();
        });

        expect(document.activeElement).toBe(
            screen.getByRole('heading', { level: 2, name: /Members/ }),
        );
    });

    it('adds the chosen workspace member and shows the server error', () => {
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

    it('has no add form when nobody is left to add', () => {
        card({ availableMembers: [] });

        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    });
});
