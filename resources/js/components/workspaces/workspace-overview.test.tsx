import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceOverview } from '@/components/workspaces/workspace-overview';
import type { WorkspaceOverviewProps } from '@/components/workspaces/workspace-overview';
import { renderWithProviders } from '@/test/render';
import type { WorkspaceTeamTile } from '@/types';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    delete: vi.fn(),
    isPhone: false,
    props: {
        translations: {},
        locale: 'en',
        auth: { user: { id: 'user-1' } },
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: mocks.props }),
    Link: ({
        href,
        children,
        ...props
    }: {
        href: string | { url: string };
        children: ReactNode;
    }) => (
        <a href={typeof href === 'string' ? href : href.url} {...props}>
            {children}
        </a>
    ),
    router: { post: mocks.post, delete: mocks.delete },
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => mocks.isPhone,
}));

const Now = Date.parse('2026-10-02T12:00:00Z');

function team(
    id: string,
    name: string,
    overrides: Partial<WorkspaceTeamTile> = {},
): WorkspaceTeamTile {
    return {
        id,
        name,
        membersCount: 2,
        members: [
            { name: 'Arnaud Ritti', avatarUrl: '' },
            { name: 'Camille Roux', avatarUrl: '' },
        ],
        isMember: true,
        activity: {
            openRetroTitle: null,
            lastRetroAt: null,
            openPokerGames: 0,
            openActionItems: 0,
            overdueActionItems: 0,
        },
        ...overrides,
    };
}

const base: WorkspaceOverviewProps = {
    workspace: { id: 'w1', name: 'Nordlys', slug: 'nordlys' },
    teams: [
        team('t1', 'Atlas'),
        team('t2', 'Borealis'),
        team('t3', 'Comet', { isMember: false }),
    ],
    membersCount: 24,
    adminsCount: 2,
    otherAdminName: 'Camille R',
    canManage: true,
};

function overview(
    props: Partial<Parameters<typeof WorkspaceOverview>[0]> = {},
) {
    return renderWithProviders(
        <WorkspaceOverview {...base} role="admin" now={Now} {...props} />,
    );
}

function subline(): string | null | undefined {
    return document.querySelector('[data-slot="workspace-subline"]')
        ?.textContent;
}

beforeEach(() => {
    mocks.post.mockReset();
    mocks.delete.mockReset();
    mocks.isPhone = false;
});

describe('WorkspaceOverview', () => {
    it('heads the page with the name, the counts and the role of the viewer', () => {
        overview();

        expect(
            screen.getByRole('heading', { level: 1, name: 'Nordlys' }),
        ).toBeTruthy();
        expect(subline()).toBe("3 teams · 24 members · you're an admin");
    });

    it('uses the singular and the other roles', () => {
        const owner = overview({
            teams: [team('t1', 'Atlas')],
            membersCount: 1,
            role: 'owner',
        });

        expect(subline()).toBe("1 team · 1 member · you're the owner");
        owner.unmount();

        const member = overview({ role: 'member', canManage: false });

        expect(subline()).toBe("3 teams · 24 members · you're a member");
        member.unmount();

        overview({ role: undefined });
        expect(subline()).toBe('3 teams · 24 members');
    });

    it('lists one tile per team, each a link to its team', () => {
        overview();

        const tiles = Array.from(
            document.querySelectorAll('a[data-slot="team-tile"]'),
        );

        expect(tiles.map((tile) => tile.getAttribute('href'))).toEqual([
            '/w/nordlys/teams/t1',
            '/w/nordlys/teams/t2',
            '/w/nordlys/teams/t3',
        ]);
        expect(
            screen.getByRole('heading', { level: 2, name: /^Teams/ })
                .textContent,
        ).toBe('Teams3');
    });

    it('leads a manager to the members and to the templates', () => {
        overview();

        expect(
            screen
                .getByRole('link', { name: 'Invite people' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/members');
        expect(
            screen
                .getByRole('link', { name: 'Manage templates' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/templates');
    });

    it('offers a member neither the invitations nor a new team, and the templates to read', () => {
        overview({ canManage: false, role: 'member' });

        expect(
            screen.queryByRole('link', { name: 'Invite people' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: /New team/ })).toBeNull();
        expect(
            screen
                .getByRole('link', { name: 'View templates' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/templates');
    });

    it('opens the new team dialog from the header and from the dashed tile', async () => {
        overview();

        await userEvent.click(
            within(
                document.querySelector(
                    '[data-slot="workspace-header"]',
                ) as HTMLElement,
            ).getByRole('button', { name: 'New team' }),
        );

        const dialog = screen.getByRole('dialog', { name: 'New team' });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        );
        expect(screen.queryByRole('dialog')).toBeNull();

        await userEvent.click(
            document.querySelector(
                '[data-slot="new-team-tile"]',
            ) as HTMLElement,
        );
        expect(screen.getByRole('dialog', { name: 'New team' })).toBeTruthy();
    });

    it('tells a manager without a team to create the first one, next to the dashed tile', () => {
        overview({ teams: [] });

        expect(
            document.querySelector('[data-slot="workspace-teams-empty"]')
                ?.textContent,
        ).toBe('No teams yet. Create the first one.');
        expect(
            document.querySelector('[data-slot="new-team-tile"]'),
        ).not.toBeNull();
    });

    it('tells a member of no team so, without a grid', () => {
        overview({ teams: [], canManage: false, role: 'member' });

        expect(
            document.querySelector('[data-slot="workspace-teams-empty"]')
                ?.textContent,
        ).toBe('You are not a member of any team yet.');
        expect(
            document.querySelector('[data-slot="workspace-teams"]'),
        ).toBeNull();
    });

    it('unfolds the leave confirmation under its row, with the teams the viewer belongs to', async () => {
        overview();

        const trigger = screen.getByRole('button', {
            name: 'Leave workspace…',
        });

        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByRole('alertdialog')).toBeNull();

        await userEvent.click(trigger);

        const panel = screen.getByRole('alertdialog');

        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(
            Array.from(panel.querySelectorAll('li')).map(
                (line) => line.textContent,
            ),
        ).toEqual([
            'You leave Atlas and Borealis.',
            "You're one of 2 admins — Camille R stays admin.",
            'An admin can invite you again later.',
        ]);
    });

    it('says nothing of admins to a member who leaves', async () => {
        overview({ canManage: false, role: 'member', otherAdminName: null });

        await userEvent.click(
            screen.getByRole('button', { name: 'Leave workspace…' }),
        );

        expect(screen.getByRole('alertdialog').textContent).not.toContain(
            'admins',
        );
    });

    it('folds the confirmation and returns the focus to its button on Cancel', async () => {
        overview();

        const trigger = screen.getByRole('button', {
            name: 'Leave workspace…',
        });

        await userEvent.click(trigger);
        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Cancel',
            }),
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('asks in a modal dialog on a phone', async () => {
        mocks.isPhone = true;
        overview();

        await userEvent.click(
            screen.getByRole('button', { name: 'Leave workspace…' }),
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(
            screen.getByRole('dialog', { name: 'Leave Nordlys?' }),
        ).toBeTruthy();
    });

    it('keeps a place for the description of a team', () => {
        overview({
            slots: {
                teamDescriptionFor: (shown) => (
                    <span data-testid={`description-${shown.id}`}>squad</span>
                ),
            },
        });

        expect(screen.getByTestId('description-t1').textContent).toBe('squad');
    });
});
