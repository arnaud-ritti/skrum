import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamPage, retroStatsFor } from '@/components/teams/team-page';
import type { TeamPageProps } from '@/components/teams/team-page';
import type { RecentSessionRow } from '@/types';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    on: vi.fn(() => () => {}),
    replace: vi.fn(),
    visit: vi.fn(),
    request: vi.fn(),
    toastError: vi.fn(),
    flash: {} as Record<string, unknown>,
    props: {
        translations: {},
        locale: 'en',
        errors: {} as Record<string, string>,
        currentWorkspace: { role: 'admin' } as { role: string } | null,
        auth: { user: { id: 'me' } },
        currentTeam: null as Record<string, unknown> | null,
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props, flash: mocks.flash }),
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
            visit: mocks.visit,
        },
    };
});

function session(values: Partial<RecentSessionRow> = {}): RecentSessionRow {
    return {
        kind: 'retro',
        id: 'retro-1',
        title: 'Sprint 41 retro',
        url: '/retros/retro-1',
        state: 'finished',
        updatedAt: '2026-09-18T10:00:00+00:00',
        participants: 9,
        meta: { phaseLabel: 'Completed', cards: 31 },
        outcome: { kind: 'actions', count: 6 },
        ...values,
    };
}

const base: TeamPageProps = {
    workspace: { id: 'w', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 'team-1', name: 'Atlas' },
    members: [
        { id: 'user-1', name: 'Camille Roux', avatarUrl: '/avatars/1.svg' },
    ],
    liveNow: [],
    recentSessions: [session()],
    hasSessions: true,
    openActionItemCount: 3,
    templateCategories: [],
    topTemplates: [],
    canCreateRetro: true,
    canSaveTemplate: false,
    icebreakerGames: [],
    gameOptions: [],
    canCreateGameRoom: true,
    roomLimit: 20,
    defaultPokerDeck: { deck: null, savedDeckId: null },
    pokerDeckOptions: [],
    canCreatePokerGame: true,
    pokerSources: [],
    pokerDecks: [],
    canCreateWhiteboard: true,
    surveys: [],
    canCreateSurvey: true,
    surveyTemplates: [],
    currentSprintNumber: null,
    defaultRetroTemplate: null,
    retroFacilitators: [],
    suggestedFacilitatorId: null,
    facilitatorRotation: false,
    viewerRole: 'owner',
    viewerIsObserver: false,
    canManageRituals: true,
    schedule: null,
    hasSprints: false,
    activity: [],
    openActionItems: [],
    overdueActionItemCount: 0,
};

const withoutSession: TeamPageProps = {
    ...base,
    recentSessions: [],
    hasSessions: false,
};

const trend: NonNullable<TeamPageProps['moodTrend']> = [
    {
        retroId: 'retro-1',
        surveyId: null,
        title: 'Sprint 41',
        completedAt: '2026-09-18T08:00:00+00:00',
        url: '/retros/retro-1',
        mood: 7.2,
        moodQ1: null,
        moodQ3: null,
        moodVoters: 4,
        roti: 4.1,
        rotiVoters: 4,
    },
];

const initialUrl = window.location.href;

/** The blocks of the grid, in the order of the document. */
function blocks(container: HTMLElement): string[] {
    return Array.from(
        container.querySelectorAll('[data-slot="team-page-grid"] > *'),
    ).map(
        (cell) =>
            cell.firstElementChild?.id ||
            cell.firstElementChild?.getAttribute('data-slot') ||
            '',
    );
}

afterEach(() => {
    window.history.replaceState(null, '', initialUrl);
    mocks.props.currentTeam = null;
    mocks.props.currentWorkspace = { role: 'admin' };
    mocks.flash = {};
    mocks.visit.mockReset();
});

describe('the team page', () => {
    it('shows the four cards and no per-kind section', () => {
        const { container } = renderWithProviders(
            <TeamPage {...base} moodTrend={trend} latestHealthScore={null} />,
        );

        expect(
            screen
                .getAllByRole('heading', { level: 2 })
                .map((heading) => heading.textContent),
        ).toEqual([
            'Needs attention3',
            'Recent sessions',
            'Team pulse',
            'Activity',
        ]);
        expect(
            container.querySelector(
                '#sessions, #mood, #members, #surveys, [data-slot="team-members-card"], [data-slot="health-check-summary"]',
            ),
        ).toBeNull();
    });

    it('shows a skeleton in place of Team pulse until the trend arrives, and no ROTI curve', () => {
        const { container, rerender } = renderWithProviders(
            <TeamPage {...base} />,
        );

        expect(blocks(container)).toContain('team-trend-loading');
        expect(container.querySelector('#team-pulse')).toBeNull();

        rerender(
            <TeamPage {...base} moodTrend={trend} latestHealthScore={3.8} />,
        );

        expect(blocks(container)).not.toContain('team-trend-loading');
        expect(
            container.querySelector('[data-slot="team-pulse-roti"]')
                ?.textContent,
        ).toBe('Average ROTI4.1 / 5');
        expect(
            container.querySelector('[data-slot="team-pulse-health"]')
                ?.textContent,
        ).toBe('Health check: 3.8 / 5');
        expect(
            container.querySelector('[data-slot="roti-trend-chart"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-slot="mood-trend-chart"]'),
        ).toBeNull();
    });

    it('reads a trend the server gave as null as a trend not received, not as an empty one', () => {
        const { container } = renderWithProviders(
            <TeamPage {...base} moodTrend={null} />,
        );

        expect(blocks(container)).toContain('team-trend-loading');
        expect(screen.queryByText('No ROTI results yet.')).toBeNull();
    });

    it('keeps the health score on screen while a visit to the same page fetches it again', () => {
        const { container, rerender } = renderWithProviders(
            <TeamPage {...base} moodTrend={trend} latestHealthScore={3.8} />,
        );

        rerender(<TeamPage {...base} />);

        expect(
            container.querySelector('[data-slot="team-pulse-health"]')
                ?.textContent,
        ).toBe('Health check: 3.8 / 5');
    });

    it('leads from Team pulse to Insights, and no longer holds the health check card', () => {
        const { container } = renderWithProviders(
            <TeamPage {...base} moodTrend={trend} latestHealthScore={null} />,
        );

        expect(
            screen.getByRole('link', { name: 'Insights' }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/insights');
        expect(
            container.querySelector('[data-slot="team-pulse-health"]')
                ?.textContent,
        ).toBe('Health check: not run yet');
        expect(screen.queryByRole('link', { name: 'Manage' })).toBeNull();
    });

    it('has one "New session" dialog trigger, and no "New …" link once the team has a session', () => {
        const { container } = renderWithProviders(<TeamPage {...base} />);

        expect(
            screen.getAllByRole('button', { name: 'New session' }),
        ).toHaveLength(1);
        expect(
            screen.queryByRole('button', { name: /New retrospective/ }),
        ).toBeNull();
        expect(container.querySelector('a[href*="?new="]')).toBeNull();
    });

    it('no longer holds the team settings, and sends an old #settings link where the Settings entry of the sidebar leads', () => {
        mocks.props.currentTeam = {
            id: 'team-1',
            name: 'Atlas',
            membersCount: 1,
            viewerRole: 'owner',
            viewerIsObserver: false,
            settingsUrl: '/w/nordlys/teams/team-1/settings',
        };
        window.history.replaceState(
            null,
            '',
            '/w/nordlys/teams/team-1#settings',
        );

        const { container } = renderWithProviders(<TeamPage {...base} />);

        expect(
            container.querySelector('[data-slot="team-settings"]'),
        ).toBeNull();
        expect(screen.queryByRole('textbox', { name: 'Team name' })).toBeNull();
        expect(mocks.visit).toHaveBeenCalledWith(
            '/w/nordlys/teams/team-1/settings',
            { replace: true },
        );
    });

    it('disables "New session" for an observer, with the reason', () => {
        const { rerender } = renderWithProviders(
            <TeamPage {...base} viewerRole="observer" viewerIsObserver />,
        );
        const trigger = () =>
            screen.getByRole('button', {
                name: 'New session',
            }) as HTMLButtonElement;

        expect(trigger().disabled).toBe(true);
        expect(trigger().getAttribute('aria-describedby')).not.toBeNull();
        expect(
            document.getElementById(
                trigger().getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('Observers cannot start sessions.');

        rerender(<TeamPage {...base} viewerRole={null} />);

        expect(trigger().disabled).toBe(false);
    });

    it('lets a workspace admin whose row says observer start a session and add an action', () => {
        renderWithProviders(
            <TeamPage
                {...base}
                viewerRole="observer"
                viewerIsObserver={false}
                openActionItems={[]}
                openActionItemCount={0}
            />,
        );

        expect(
            (
                screen.getByRole('button', {
                    name: 'New session',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
        expect(
            screen.queryByText('Observers cannot start sessions.'),
        ).toBeNull();
        expect(
            screen.getByRole('heading', { name: /Needs attention/ }),
        ).toBeTruthy();
    });

    it('counts a retro by its phase: who joined and the cards while writing, the groups once grouped, the action items once closed', () => {
        const stats = { participants: 8, cards: 23, groups: 6, actionItems: 4 };
        const retro = (phase: string) =>
            ({ phase, stats }) as Parameters<typeof retroStatsFor>[0];

        expect(retroStatsFor(retro('writing'))).toEqual({
            participants: 8,
            joined: true,
            cards: 23,
        });
        expect(retroStatsFor(retro('grouping'))).toEqual({
            participants: 8,
            joined: true,
            cards: 23,
        });

        for (const phase of ['voting', 'discussing', 'actions', 'roti']) {
            expect(retroStatsFor(retro(phase))).toEqual({
                participants: 8,
                joined: true,
                cards: 23,
                groups: 6,
            });
        }

        expect(retroStatsFor(retro('completed'))).toEqual({
            participants: 8,
            cards: 23,
            actions: 4,
        });
    });

    it('shows no gear in the header, whatever settings the viewer may open', () => {
        mocks.props.currentTeam = {
            id: 'team-1',
            name: 'Atlas',
            membersCount: 1,
            viewerRole: 'owner',
            viewerIsObserver: false,
            settingsUrl: '/w/nordlys/teams/team-1/settings',
        };

        const { container } = renderWithProviders(
            <TeamPage {...base} hasSprints />,
        );

        expect(
            screen.queryByRole('link', { name: 'Team settings' }),
        ).toBeNull();
        expect(
            Array.from(
                container.querySelectorAll('[data-slot="team-header"] a'),
            ).map((link) => link.getAttribute('href')),
        ).toEqual(['/w/nordlys/teams/team-1/members']);
    });

    it('fills the places from the props: schedule, open actions, recent sessions and activity', () => {
        const { container } = renderWithProviders(
            <TeamPage
                {...base}
                schedule={{
                    sprint: {
                        id: 'sprint-42',
                        number: 42,
                        startsOn: '2026-09-21',
                        endsOn: '2026-10-04',
                    },
                    nextRetro: null,
                }}
                hasSprints
                recentSessions={[
                    session({
                        kind: 'whiteboard',
                        id: 'board-1',
                        title: 'Invite flow',
                        url: '/whiteboards/board-1',
                        meta: { facilitatorName: null },
                        outcome: null,
                    }),
                ]}
            />,
        );

        expect(
            container.querySelector(
                '[data-slot="team-header"] [data-slot="team-schedule"]',
            )?.textContent,
        ).toBe('Sprint 42');
        expect(
            container
                .querySelector('#recent-sessions [data-slot="session-row"]')
                ?.getAttribute('href'),
        ).toBe('/whiteboards/board-1');
        expect(
            screen
                .getByRole('link', { name: 'All sessions' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/sessions');
        expect(
            screen.getByRole('link', { name: 'See all' }).getAttribute('href'),
        ).toBe('/w/nordlys/action-items?team=team-1');
        expect(container.querySelector('#activity')).not.toBeNull();
    });

    it('shows the kind tiles and no recent sessions for a team without session', () => {
        const { container, rerender } = renderWithProviders(
            <TeamPage {...withoutSession} />,
        );
        const tiles = () =>
            container.querySelector('[data-slot="team-create-tiles"]');

        expect(
            Array.from(tiles()?.querySelectorAll('a') ?? []).map((tile) =>
                tile.getAttribute('href'),
            ),
        ).toEqual([
            '/w/nordlys/teams/team-1?new=retro',
            '/w/nordlys/teams/team-1?new=poker',
            '/w/nordlys/teams/team-1?new=whiteboard',
            '/w/nordlys/teams/team-1?new=survey',
        ]);
        expect(tiles()?.previousElementSibling?.getAttribute('data-slot')).toBe(
            'team-header',
        );
        expect(container.querySelector('#recent-sessions')).toBeNull();
        expect(blocks(container)).toEqual([
            'open-actions',
            'team-trend-loading',
            'activity',
        ]);

        rerender(<TeamPage {...base} />);

        expect(tiles()).toBeNull();
        expect(container.querySelector('#recent-sessions')).not.toBeNull();
    });

    it('offers no creation tile to an observer, and only the types the viewer may create', () => {
        const { container, unmount } = renderWithProviders(
            <TeamPage
                {...withoutSession}
                viewerIsObserver
                canCreateSurvey={false}
            />,
        );

        expect(
            container.querySelector('[data-slot="team-create-tiles"]'),
        ).toBeNull();
        expect(container.querySelector('a[href*="?new="]')).toBeNull();

        unmount();

        const { container: limited } = renderWithProviders(
            <TeamPage {...withoutSession} canCreatePokerGame={false} />,
        );

        expect(
            limited.querySelectorAll('[data-slot="team-create-tiles"] a'),
        ).toHaveLength(3);
        expect(limited.querySelector('a[href$="?new=poker"]')).toBeNull();
    });

    it('offers to start the first sprint, on the rituals page, to who may set the rituals of a team without sprints', () => {
        const { rerender } = renderWithProviders(<TeamPage {...base} />);
        const link = () =>
            screen.queryByRole('link', { name: 'Start the first sprint' });

        expect(link()?.getAttribute('href')).toBe(
            '/w/nordlys/teams/team-1/rituals',
        );

        rerender(<TeamPage {...base} canManageRituals={false} />);

        expect(link()).toBeNull();
    });

    it('lets a slot given replace the place the props fill', () => {
        const { container } = renderWithProviders(
            <TeamPage
                {...base}
                slots={{
                    schedule: <span data-place="schedule" />,
                    recentSessions: <div data-slot="recent" />,
                    openActions: <div data-slot="actions" />,
                    activity: <div data-slot="activity" />,
                }}
            />,
        );

        expect(
            container.querySelector(
                '[data-slot="team-header"] [data-place="schedule"]',
            ),
        ).not.toBeNull();
        expect(blocks(container)).toEqual([
            'actions',
            'recent',
            'team-trend-loading',
            'activity',
        ]);
    });

    it('offers no "Invite" and no members card: the stack of the header leads to Members', () => {
        const { container } = renderWithProviders(
            <TeamPage {...base} viewerRole="facilitator" />,
        );

        expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(container.querySelector('#members')).toBeNull();
        expect(
            screen.getByRole('link', { name: '1 member' }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/members');
    });

    it('shows the live banner with Join when a session is live, and none otherwise', () => {
        const { container, rerender } = renderWithProviders(
            <TeamPage
                {...base}
                liveNow={[
                    session({
                        id: 'r1',
                        title: 'Sprint 42 retro',
                        url: '/w/nordlys/retros/r1',
                        state: 'live',
                    }),
                ]}
            />,
        );
        const banner = () =>
            container.querySelector('[data-slot="live-session-banner"]');

        expect(
            banner()?.previousElementSibling?.getAttribute('data-slot'),
        ).toBe('team-header');
        expect(banner()?.nextElementSibling?.getAttribute('data-slot')).toBe(
            'team-page-grid',
        );
        expect(
            screen.getByRole('link', { name: 'Join' }).getAttribute('href'),
        ).toBe('/w/nordlys/retros/r1');
        expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();

        rerender(<TeamPage {...base} />);

        expect(banner()).toBeNull();
        expect(screen.queryByRole('link', { name: 'Join' })).toBeNull();
    });

    it('shows no banner for a session flashed: the live sessions of the page feed it', () => {
        mocks.flash = {
            liveSession: {
                kind: 'retro',
                title: 'Sprint 42 retro',
                url: '/w/nordlys/retros/r1',
            },
        };
        const { container } = renderWithProviders(<TeamPage {...base} />);

        expect(
            container.querySelector('[data-slot="live-session-banner"]'),
        ).toBeNull();
    });

    it('puts Needs attention before Recent sessions on a phone', () => {
        const { container } = renderWithProviders(
            <TeamPage {...base} moodTrend={trend} latestHealthScore={null} />,
        );
        const cells = Array.from(
            container.querySelectorAll('[data-slot="team-page-grid"] > *'),
        );

        expect(blocks(container)).toEqual([
            'open-actions',
            'recent-sessions',
            'team-pulse',
            'activity',
        ]);
        expect(
            cells.map((cell) =>
                Array.from(cell.classList).filter((name) =>
                    name.includes('order-'),
                ),
            ),
        ).toEqual([
            ['lg:order-1'],
            ['lg:order-3'],
            ['lg:order-2'],
            ['lg:order-4'],
        ]);
    });
});
