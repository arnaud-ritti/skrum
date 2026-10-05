import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamPage, retroStatsFor } from '@/components/teams/team-page';
import type { TeamPageProps } from '@/components/teams/team-page';
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
    canSaveTemplate: false,
    icebreakerGames: [],
    gameOptions: [],
    canCreateGameRoom: true,
    roomLimit: 20,
    pokerGames: [],
    defaultPokerDeck: { deck: null, savedDeckId: null },
    pokerDeckOptions: [],
    canCreatePokerGame: true,
    pokerSources: [],
    canManageIntegrations: false,
    pokerDecks: [],
    whiteboards: [],
    canCreateWhiteboard: true,
    surveys: [],
    canCreateSurvey: true,
    surveyTemplates: [],
    whiteboardTemplates: [],
    pokerPresence: {},
    currentSprintNumber: null,
    defaultRetroTemplate: null,
    retroFacilitators: [],
    suggestedFacilitatorId: null,
    facilitatorRotation: false,
    roleOptions: [],
    viewerRole: 'owner',
    viewerIsObserver: false,
    canManageRituals: true,
    schedule: null,
    hasSprints: false,
    activity: [],
    recentSessions: [],
    openActionItems: [],
    overdueActionItemCount: 0,
    canInvite: false,
    inviteRoles: ['facilitator', 'member', 'observer'],
    pendingInvitations: [],
};

const initialUrl = window.location.href;

afterEach(() => {
    window.history.replaceState(null, '', initialUrl);
    mocks.props.currentTeam = null;
    mocks.props.currentWorkspace = { role: 'admin' };
    mocks.visit.mockReset();
});

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
                        moodQ1: null,
                        moodQ3: null,
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

    it('no longer holds the team settings, and sends an old #settings link where the gear leads', () => {
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
            screen.getByRole('heading', { name: /Open action items/ }),
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

    it('leads the gear of the header where the "Team settings" entry of the sidebar leads', () => {
        const gear = () =>
            screen
                .queryByRole('link', { name: 'Team settings' })
                ?.getAttribute('href');
        const currentTeam = {
            id: 'team-1',
            name: 'Atlas',
            membersCount: 1,
            viewerRole: 'owner',
            viewerIsObserver: false,
            settingsUrl: '/w/nordlys/teams/team-1/settings',
        };

        mocks.props.currentTeam = currentTeam;

        const { rerender } = renderWithProviders(<TeamPage {...base} />);

        expect(gear()).toBe('/w/nordlys/teams/team-1/settings');

        mocks.props.currentTeam = { ...currentTeam, settingsUrl: null };
        rerender(<TeamPage {...base} />);

        expect(gear()).toBeUndefined();

        mocks.props.currentTeam = { ...currentTeam, id: 'team-2' };
        rerender(<TeamPage {...base} />);

        expect(gear()).toBeUndefined();
    });

    it('fills the places from the props: schedule, recent sessions, open actions, activity, roles and thumbnails', () => {
        const { container } = renderWithProviders(
            <TeamPage
                {...base}
                members={[{ ...base.members[0], role: 'facilitator' }]}
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
                    {
                        kind: 'whiteboard',
                        id: 'board-1',
                        title: 'Invite flow',
                        url: '/whiteboards/board-1',
                        state: 'live',
                        updatedAt: '2026-09-18T10:00:00+00:00',
                        participants: 5,
                        meta: { facilitatorName: null },
                        outcome: null,
                    },
                ]}
                whiteboards={[
                    {
                        id: 'board-1',
                        title: 'Invite flow',
                        updatedAt: '2026-09-18T10:00:00+00:00',
                        facilitatorName: null,
                        canDelete: false,
                        preview: null,
                    },
                ]}
            />,
        );
        const sessions = container.querySelector('#sessions') as HTMLElement;

        expect(
            container.querySelector(
                '[data-slot="team-header"] [data-slot="team-schedule"]',
            )?.textContent,
        ).toBe('Sprint 42');
        expect(sessions.firstElementChild?.id).toBe('recent-sessions');
        expect(sessions.parentElement?.lastElementChild?.id).toBe('activity');
        expect(container.querySelector('aside')?.firstElementChild?.id).toBe(
            'open-actions',
        );
        expect(
            container.querySelector('#members [data-test="member-role"]')
                ?.textContent,
        ).toBe('Facilitator');
        expect(
            container.querySelector(
                '[data-slot="team-whiteboards"] [data-slot="whiteboard-thumbnail"]',
            ),
        ).not.toBeNull();
    });

    it('offers to start the first sprint to who may set the rituals of a team without sprints', () => {
        const { rerender } = renderWithProviders(<TeamPage {...base} />);
        const link = () =>
            screen.queryByRole('link', { name: 'Start the first sprint' });

        expect(link()?.getAttribute('href')).toBe(
            '/w/nordlys/teams/team-1/members#sprints',
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

    it('offers "Invite" in the members card to the team inviters only', async () => {
        const { unmount } = renderWithProviders(<TeamPage {...base} />);

        expect(
            within(document.querySelector('#members')!).queryByRole('button', {
                name: 'Invite',
            }),
        ).toBeNull();
        unmount();

        renderWithProviders(
            <TeamPage
                {...base}
                canManage={false}
                viewerRole="facilitator"
                canInvite
            />,
        );
        await userEvent.click(
            within(document.querySelector('#members')!).getByRole('button', {
                name: 'Invite',
            }),
        );

        expect(screen.getByRole('dialog').textContent).toContain(
            'Invite to Atlas',
        );
        expect(mocks.reload).toHaveBeenCalledWith({ only: ['inviteLink'] });
    });

    it('shows the session in progress flashed on landing, until dismissed', async () => {
        mocks.flash = {
            liveSession: {
                kind: 'retro',
                title: 'Sprint 42 retro',
                url: '/w/nordlys/retros/r1',
            },
        };
        const { container, rerender } = renderWithProviders(
            <TeamPage {...base} />,
        );

        expect(
            container.firstElementChild?.firstElementChild?.getAttribute(
                'data-slot',
            ),
        ).toBe('live-session-banner');
        expect(
            screen.getByRole('link', { name: 'Join' }).getAttribute('href'),
        ).toBe('/w/nordlys/retros/r1');

        mocks.flash = {};
        rerender(<TeamPage {...base} openActionItemCount={4} />);

        expect(
            container.querySelector('[data-slot="live-session-banner"]'),
        ).not.toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

        expect(
            container.querySelector('[data-slot="live-session-banner"]'),
        ).toBeNull();
    });

    it('shows no banner without a session flashed', () => {
        mocks.flash = {};
        const { container } = renderWithProviders(<TeamPage {...base} />);

        expect(
            container.querySelector('[data-slot="live-session-banner"]'),
        ).toBeNull();
    });
});
