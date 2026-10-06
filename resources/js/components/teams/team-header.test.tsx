import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamHeader } from '@/components/teams/team-header';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    props: {
        translations: {},
        locale: 'en',
        errors: {} as Record<string, string>,
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
        },
    };
});

const members = ['Ada', 'Bob', 'Cy', 'Di', 'Eve'].map((name, index) => ({
    id: `user-${index}`,
    name,
    avatarUrl: `/avatars/${index}.svg`,
}));

function header(props: Partial<Parameters<typeof TeamHeader>[0]> = {}) {
    return renderWithProviders(
        <TeamHeader
            workspace={{ id: 'w', name: 'Nordlys', slug: 'nordlys' }}
            team={{ id: 'team-1', name: 'Atlas' }}
            members={members}
            {...props}
        />,
    );
}

describe('the team header', () => {
    it('counts a single member in the singular', () => {
        header({ members: members.slice(0, 1) });

        expect(screen.getByText('1 member')).toBeTruthy();
    });

    it('names the team, counts its members and names its workspace', () => {
        const { container } = header();

        expect(
            screen.getByRole('heading', { level: 1, name: 'Atlas' }),
        ).toBeTruthy();
        expect(screen.getByText('5 members')).toBeTruthy();
        expect(screen.getByText('Nordlys workspace')).toBeTruthy();
        expect(
            container.querySelectorAll(
                '[data-slot="avatar-stack"] [data-slot="person-avatar"]',
            ),
        ).toHaveLength(4);
        expect(
            container.querySelector('[data-slot="avatar-stack-more"]'),
        ).toBeNull();
    });

    it('links the members stack to Members', () => {
        const { container } = header();
        const link = screen.getByRole('link', { name: '5 members' });

        expect(link.getAttribute('href')).toBe(
            '/w/nordlys/teams/team-1/members',
        );
        expect(link.querySelector('[data-slot="avatar-stack"]')).not.toBeNull();
        expect(link.textContent).toContain('5 members');
        expect(container.querySelectorAll('a')).toHaveLength(1);
    });

    it('no longer links to the action items of the team: the sidebar leads to them', () => {
        header();

        expect(
            screen.queryByRole('link', { name: /Open action items/ }),
        ).toBeNull();
    });

    it('no longer links to the games: Insights and the sessions hold them', () => {
        header();

        expect(screen.queryByRole('link', { name: 'Team games' })).toBeNull();
    });

    it('shows no gear: the sidebar leads to the team settings', () => {
        header();

        expect(
            screen.queryByRole('link', { name: 'Team settings' }),
        ).toBeNull();
    });

    it('renders the new session trigger and leaves the schedule place empty', () => {
        const { container } = header({
            newSession: <button>New session</button>,
        });

        expect(
            screen.getByRole('button', { name: 'New session' }),
        ).toBeTruthy();
        expect(container.textContent).not.toContain('Next retro');
    });
});
