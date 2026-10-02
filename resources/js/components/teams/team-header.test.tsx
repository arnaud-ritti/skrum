import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamHeader, splitCount } from '@/components/teams/team-header';
import { renderWithProviders } from '@/test/render';
import type { TeamMember } from '@/types';

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

const members: TeamMember[] = ['Ada', 'Bob', 'Cy', 'Di', 'Eve'].map(
    (name, index) => ({
        id: `user-${index}`,
        name,
        email: `${name.toLowerCase()}@example.com`,
        avatarUrl: `/avatars/${index}.svg`,
    }),
);

function header(props: Partial<Parameters<typeof TeamHeader>[0]> = {}) {
    return renderWithProviders(
        <TeamHeader
            workspace={{ id: 'w', name: 'Nordlys', slug: 'nordlys' }}
            team={{ id: 'team-1', name: 'Atlas' }}
            members={members}
            openActionItemCount={7}
            canManageIntegrations={false}
            {...props}
        />,
    );
}

describe('splitCount', () => {
    it('takes the count off the end of the sentence', () => {
        expect(splitCount('Open action items (7)')).toEqual({
            text: 'Open action items',
            count: '7',
        });
        expect(splitCount('Actions ouvertes (12)')).toEqual({
            text: 'Actions ouvertes',
            count: '12',
        });
    });

    it('keeps a sentence that does not end with its count whole', () => {
        expect(splitCount('7 open action items')).toEqual({
            text: '7 open action items',
        });
    });
});

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

    it('links to the action items of the team, with the count as a badge inside one sentence', () => {
        header();

        const link = screen.getByRole('link', {
            name: 'Open action items (7)',
        });

        expect(link.textContent).toBe('Open action items (7)');
        expect(link.getAttribute('href')).toContain(
            '/w/nordlys/action-items?team=team-1',
        );
    });

    it('links to the games, and to the integrations only for who manages them', () => {
        const { rerender } = header();

        expect(
            screen.getByRole('link', { name: 'Games' }).getAttribute('href'),
        ).toMatch(/\/games$/);
        expect(screen.queryByRole('link', { name: 'Integrations' })).toBeNull();

        rerender(
            <TeamHeader
                workspace={{ id: 'w', name: 'Nordlys', slug: 'nordlys' }}
                team={{ id: 'team-1', name: 'Atlas' }}
                members={members}
                openActionItemCount={0}
                canManageIntegrations
            />,
        );

        expect(
            screen
                .getByRole('link', { name: 'Integrations' })
                .getAttribute('href'),
        ).toMatch(/\/integrations$/);
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
