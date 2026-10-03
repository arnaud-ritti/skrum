import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamPage, teamSettingsHref } from '@/components/teams/team-page';
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
        Deferred: ({ fallback }: { fallback: () => React.ReactNode }) => (
            <>{fallback()}</>
        ),
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
    surveys: [],
    canCreateSurvey: true,
    surveyTemplates: [],
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
        ).toHaveLength(4);
        expect(
            Array.from(container.querySelectorAll('#sessions h2')).map(
                (heading) => heading.textContent,
            ),
        ).toEqual([
            'Retrospectives0',
            'Planning poker',
            'Whiteboards0',
            'Surveys0',
        ]);
        expect(
            container.querySelector('#sessions > section#surveys'),
        ).not.toBeNull();
    });

    it('draws the ROTI curve alone in the main column, under the sessions, a skeleton until the trend arrives', () => {
        const { container, rerender } = renderWithProviders(
            <TeamPage {...base} />,
        );
        const mood = () => container.querySelector('#mood');

        expect(mood()?.firstElementChild?.getAttribute('data-slot')).toBe(
            'team-trend-loading',
        );
        expect(mood()?.closest('aside')).toBeNull();
        expect(mood()?.previousElementSibling?.id).toBe('sessions');

        rerender(
            <TeamPage
                {...base}
                moodTrend={[
                    {
                        retroId: 'retro-1',
                        surveyId: null,
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

        expect(mood()?.firstElementChild?.getAttribute('data-slot')).toBe(
            'team-roti',
        );
        expect(
            container.querySelectorAll('#mood [data-slot="roti-trend-point"]'),
        ).toHaveLength(1);
        expect(screen.queryByRole('tab', { name: 'Mood' })).toBeNull();
        expect(screen.queryByRole('tab', { name: 'ROTI' })).toBeNull();
        expect(
            container.querySelector('[data-slot="mood-trend-chart"]'),
        ).toBeNull();
    });

    it('reads a trend the server gave as null as a trend not received, not as an empty one', () => {
        const { container } = renderWithProviders(
            <TeamPage {...base} moodTrend={null} />,
        );

        expect(
            container
                .querySelector('#mood')
                ?.firstElementChild?.getAttribute('data-slot'),
        ).toBe('team-trend-loading');
    });

    it('shows the health check as a compact card in the side column, with the way to its page', () => {
        const { container } = renderWithProviders(
            <TeamPage
                {...base}
                canManageHealthStatements
                healthStatements={[
                    {
                        id: 'interaction',
                        key: 'interaction',
                        label: 'Interaction',
                        text: 'Interaction with colleagues was productive',
                        isBuiltin: true,
                        isArchived: false,
                    },
                ]}
            />,
        );
        const card = container.querySelector(
            'aside [data-slot="health-check-summary"]',
        );

        expect(card).not.toBeNull();
        expect(
            container.querySelector('[data-slot="health-statements"]'),
        ).toBeNull();
        expect(
            screen.getByRole('link', { name: 'Manage' }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/health-check');
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

    it('leads the gear of the header where the "Team settings" entry of the sidebar leads', () => {
        const { rerender } = renderWithProviders(<TeamPage {...base} />);
        const gear = () =>
            screen
                .queryByRole('link', { name: 'Team settings' })
                ?.getAttribute('href');

        expect(gear()).toMatch(/\/teams\/team-1#settings$/);

        rerender(<TeamPage {...base} canManageIntegrations />);

        expect(gear()).toMatch(/\/teams\/team-1\/integrations$/);

        rerender(<TeamPage {...base} canManage={false} />);

        expect(gear()).toBeUndefined();
    });

    it('gives the settings address of a manager, of who manages the integrations, and none to a member', () => {
        const scope = { workspace: base.workspace, team: base.team };

        expect(
            teamSettingsHref({
                ...scope,
                canManage: true,
                canManageIntegrations: false,
            }),
        ).toMatch(/#settings$/);
        expect(
            teamSettingsHref({
                ...scope,
                canManage: false,
                canManageIntegrations: true,
            }),
        ).toMatch(/\/integrations$/);
        expect(
            teamSettingsHref({
                ...scope,
                canManage: false,
                canManageIntegrations: false,
            }),
        ).toBeUndefined();
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
        expect(
            sessions.parentElement?.lastElementChild?.getAttribute(
                'data-place',
            ),
        ).toBe('activity');
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
