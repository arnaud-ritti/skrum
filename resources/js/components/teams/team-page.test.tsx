import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamPage } from '@/components/teams/team-page';
import type { TeamPageProps } from '@/components/teams/team-page';
import { renderWithProviders } from '@/test/render';

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

const base: TeamPageProps = {
    workspace: { id: 'w', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 'team-1', name: 'Atlas' },
    members: [
        {
            id: 'user-1',
            name: 'Camille Roux',
            email: 'camille@example.com',
            avatarUrl: '/avatars/1.svg',
        },
    ],
    availableMembers: [],
    canManage: true,
    openActionItemCount: 3,
    retros: [],
    templateCategories: [],
    topTemplates: [],
    canCreateRetro: true,
    healthStatements: [],
    canManageHealthStatements: false,
    llm: { enabled: false, provider: null },
    icebreakerGames: [],
    gameOptions: [],
    canCreateGameRoom: true,
    roomLimit: 20,
    pokerGames: [],
    defaultPokerDeck: { deck: null, savedDeckId: null },
    pokerDeckOptions: [],
    canCreatePokerGame: true,
    canManageIntegrations: false,
    pokerDecks: [],
    whiteboards: [],
    canCreateWhiteboard: true,
    whiteboardTemplates: [],
    pokerPresence: {},
};

describe('the team page', () => {
    it('has the three anchored regions of the sidebar, in the order sessions, mood, members', () => {
        const { container } = renderWithProviders(<TeamPage {...base} />);
        const ids = Array.from(
            container.querySelectorAll('#sessions, #mood, #members'),
        ).map((node) => node.id);

        expect(ids).toEqual(['sessions', 'mood', 'members']);
        expect(
            container
                .querySelector('#sessions')
                ?.querySelectorAll(':scope > section'),
        ).toHaveLength(3);
        expect(
            Array.from(container.querySelectorAll('#sessions h2')).map(
                (heading) => heading.textContent,
            ),
        ).toEqual(['Retrospectives0', 'Planning poker', 'Whiteboards0']);
    });

    it('opens the mood region with the trend card, a skeleton until the trend arrives', () => {
        const { container, rerender } = renderWithProviders(
            <TeamPage {...base} />,
        );
        const first = () =>
            container
                .querySelector('#mood')
                ?.firstElementChild?.getAttribute('data-slot');

        expect(first()).toBe('team-mood-loading');

        rerender(
            <TeamPage
                {...base}
                moodTrend={[
                    {
                        retroId: 'retro-1',
                        title: 'Sprint 41',
                        completedAt: '2026-09-18T08:00:00+00:00',
                        url: '/retros/retro-1',
                        mood: 7.2,
                        moodVoters: 4,
                        roti: 4.1,
                        rotiVoters: 4,
                    },
                ]}
            />,
        );

        expect(first()).toBe('team-mood');
        expect(
            container.querySelectorAll('#mood [data-slot="mood-trend-point"]'),
        ).toHaveLength(1);
        expect(
            container.querySelector(
                '#mood [data-slot="team-mood"] ~ [data-slot="health-statements"]',
            ),
        ).not.toBeNull();
    });

    it('has one "New session" trigger and no trigger per type', () => {
        renderWithProviders(<TeamPage {...base} />);

        expect(
            screen.getAllByRole('button', { name: 'New session' }),
        ).toHaveLength(1);
        expect(screen.queryByText('New retrospective')).toBeNull();
        expect(screen.queryByText('New game')).toBeNull();
        expect(screen.queryByText('New whiteboard')).toBeNull();
    });

    it('shows the team settings to who manages the team only', () => {
        const { container, rerender } = renderWithProviders(
            <TeamPage {...base} />,
        );

        expect(
            container.querySelector('[data-slot="team-settings"]'),
        ).not.toBeNull();

        rerender(<TeamPage {...base} canManage={false} />);

        expect(
            container.querySelector('[data-slot="team-settings"]'),
        ).toBeNull();
        expect(screen.queryByRole('textbox', { name: 'Team name' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete team' }),
        ).toBeNull();
    });

    it('renders nothing in the places left, and fills each from its slot', () => {
        const { container, rerender } = renderWithProviders(
            <TeamPage {...base} />,
        );

        expect(container.querySelector('[data-place]')).toBeNull();

        rerender(
            <TeamPage
                {...base}
                slots={{
                    schedule: <span data-place="schedule" />,
                    recentSessions: <div data-place="recent" />,
                    openActions: <div data-place="actions" />,
                    activity: <div data-place="activity" />,
                    inviteAction: <button data-place="invite">Invite</button>,
                    roleBadgeFor: () => <span data-place="role" />,
                }}
            />,
        );

        const sessions = container.querySelector('#sessions') as HTMLElement;

        expect(
            container.querySelector(
                '[data-slot="team-header"] [data-place="schedule"]',
            ),
        ).not.toBeNull();
        expect(sessions.firstElementChild?.getAttribute('data-place')).toBe(
            'recent',
        );
        expect(sessions.lastElementChild?.getAttribute('data-place')).toBe(
            'activity',
        );
        expect(
            container
                .querySelector('aside')
                ?.firstElementChild?.getAttribute('data-place'),
        ).toBe('actions');
        expect(
            container.querySelector('#members [data-place="invite"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('#members [data-place="role"]'),
        ).not.toBeNull();
    });
});
