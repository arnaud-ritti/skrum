import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { TeamHealthCard } from '@/components/teams/team-health-card';
import { TeamHealthCheckPage } from '@/components/teams/team-health-check-page';
import { TeamMembersCard } from '@/components/teams/team-members-card';
import { TeamPage } from '@/components/teams/team-page';
import type { TeamPageProps } from '@/components/teams/team-page';
import { TeamPokerSection } from '@/components/teams/team-poker-section';
import { TeamRetrosSection } from '@/components/teams/team-retros-section';
import { TeamRotiCard } from '@/components/teams/team-roti-card';
import { TeamSurveysSection } from '@/components/teams/team-surveys-section';
import { TeamWhiteboardsSection } from '@/components/teams/team-whiteboards-section';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItem } from '@/lib/retro/types';
import type {
    PokerGameSummary,
    RecentSessionRow,
    TeamActivityLine,
    TeamHealthStatement,
    TeamMember,
    TeamMoodPoint,
    TeamRole,
} from '@/types';

export const group: BenchGroup = 'layouts';

function avatar(digit: string): string {
    return `/avatars/${digit.repeat(32)}.svg`;
}

const memberRoles: TeamRole[] = ['owner', 'facilitator', 'member', 'observer'];

/** Names, titles and labels come from the server, already in the user's language. */
const members: TeamMember[] = [
    'Arnaud Ritti',
    'Camille Roux',
    'Théo Martin',
    'Inès Benali',
    'Malik Kone',
    'Sofia Lindqvist',
    'Noa Kim',
    'Maximilian Alexander von Hohenberg-Lichtenstein',
    'Zoé Petit',
].map((name, index) => ({
    id: `member-${index}`,
    name,
    email: `${name.toLowerCase().replaceAll(' ', '.')}@nordlys.example`,
    avatarUrl: avatar(index.toString()),
    role: memberRoles[index] ?? 'member',
}));

const healthStatements: TeamHealthStatement[] = [
    [
        'interaction',
        'Interaction',
        'Interaction with colleagues was productive',
    ],
    ['task_clarity', 'Clear tasks', 'Tasks assigned to me were clear'],
    ['vision', 'Vision', 'The vision and goals are clear to me'],
    ['processes', 'Processes', 'Our processes let me work without blockers'],
    ['motivation', 'Motivation', 'I felt motivated in my work'],
].map(([key, label, text]) => ({
    id: key,
    key,
    label,
    text,
    isBuiltin: true,
    isArchived: false,
}));

healthStatements.push(
    {
        id: 'custom-1',
        key: 'custom-1',
        label: 'Delivery',
        text: 'We shipped what we promised at the start of the sprint, without cutting the scope',
        isBuiltin: false,
        isArchived: false,
    },
    {
        id: 'manager_support',
        key: 'manager_support',
        label: 'Manager support',
        text: 'My manager was understanding and supportive',
        isBuiltin: true,
        isArchived: true,
    },
);

const minutesAgo = (minutes: number): string =>
    new Date(Date.now() - minutes * 60_000).toISOString();

const games: PokerGameSummary[] = [
    {
        id: 'game-1',
        title: 'Sprint 43 refinement',
        deckLabel: 'Fibonacci',
        tasksCount: 6,
        estimatedCount: 3,
        totalPoints: 16,
        endedAt: null,
        lastActivityAt: minutesAgo(12),
    },
    {
        id: 'game-2',
        title: 'Billing epic sizing, with a title long enough to be cut',
        deckLabel: 'T-shirt sizes',
        tasksCount: 9,
        estimatedCount: 2,
        totalPoints: null,
        endedAt: null,
        lastActivityAt: minutesAgo(120),
    },
    {
        id: 'game-3',
        title: 'Mobile app spikes',
        deckLabel: 'Hours (custom)',
        tasksCount: 4,
        estimatedCount: 4,
        totalPoints: 26,
        endedAt: minutesAgo(60 * 26),
        lastActivityAt: minutesAgo(60 * 26),
    },
];

const moodTrend: TeamMoodPoint[] = [
    [37, 3.2, 7, 3.6, 8],
    [38, 3.5, 8, 3.9, 8],
    [39, null, 0, 3.4, 6],
    [40, 3.6, 8, 3.8, 9],
    [41, 3.9, 9, 4.1, 9],
].map(([sprint, mood, moodVoters, roti, rotiVoters], index) => ({
    retroId: `retro-sprint-${sprint}`,
    surveyId: null,
    title: `Sprint ${sprint} retrospective`,
    completedAt: new Date(Date.UTC(2026, 6, 24 + index * 14, 8)).toISOString(),
    url: `/retros/retro-sprint-${sprint}`,
    mood,
    moodQ1: null,
    moodQ3: null,
    moodVoters: moodVoters ?? 0,
    roti,
    rotiVoters: rotiVoters ?? 0,
    sprintLabel: `S${sprint}`,
}));

const liveNow: RecentSessionRow[] = [
    {
        kind: 'poker',
        id: 'game-1',
        title: 'Sprint 43 refinement',
        url: '/poker/game-1',
        state: 'live',
        updatedAt: minutesAgo(12),
        participants: 8,
        meta: { tasks: 6 },
        outcome: null,
    },
    {
        kind: 'game',
        id: 'room-1',
        title: 'Monday warm-up',
        url: '/games/room-1',
        state: 'live',
        updatedAt: minutesAgo(40),
        participants: 5,
        meta: { gameLabel: 'Two truths and a lie' },
        outcome: null,
    },
];

const recentSessions: RecentSessionRow[] = [
    {
        kind: 'retro',
        id: 'retro-3',
        title: 'Sprint 41 retrospective',
        url: '/retros/retro-3',
        state: 'finished',
        updatedAt: '2026-09-18T10:00:00+00:00',
        participants: 9,
        meta: { phaseLabel: 'Completed', cards: 31 },
        outcome: { kind: 'actions', count: 6 },
    },
    {
        kind: 'survey',
        id: 'survey-2',
        title: 'Workload Q3',
        url: '/surveys/survey-2',
        state: 'finished',
        updatedAt: '2026-09-16T10:00:00+00:00',
        participants: 7,
        meta: { questions: 5 },
        outcome: { kind: 'answers', count: 7 },
    },
    {
        kind: 'whiteboard',
        id: 'board-1',
        title: 'Invite flow — user journey',
        url: '/whiteboards/board-1',
        state: 'upcoming',
        updatedAt: '2026-09-11T10:00:00+00:00',
        participants: 5,
        meta: { facilitatorName: 'Inès Benali' },
        outcome: null,
    },
];

const activity: TeamActivityLine[] = [
    {
        id: 'activity-1',
        kind: 'action_item_completed',
        actor: { name: 'Noa Kim', avatarUrl: avatar('6') },
        subject: { title: 'Quarantine the flaky E2E tests', url: null },
        at: minutesAgo(12),
    },
    {
        id: 'activity-2',
        kind: 'poker_started',
        actor: { name: 'Camille Roux', avatarUrl: avatar('1') },
        subject: { title: 'Sprint 43 refinement', url: '/poker/game-1' },
        at: minutesAgo(34),
    },
    {
        id: 'activity-3',
        kind: 'action_item_completed',
        actor: { name: 'Jira', avatarUrl: null },
        subject: { title: 'Automate the release changelog', url: null },
        at: minutesAgo(60 * 26),
    },
];

function openItem(values: Partial<ActionItem>): ActionItem {
    return {
        id: 'item',
        retroId: null,
        teamId: 'atlas',
        content: '',
        priority: 'medium',
        dueOn: null,
        isOverdue: false,
        status: 'open',
        completedAt: null,
        startedAt: null,
        completedVia: null,
        assignee: null,
        createdBy: null,
        isMine: false,
        commentCount: 0,
        source: null,
        themeId: null,
        themeName: null,
        recurrence: null,
        previousOccurrenceId: null,
        subtasks: [],
        createdAt: null,
        externalLinks: null,
        cardId: null,
        ...values,
    };
}

const openActionItems: ActionItem[] = [
    openItem({
        id: 'item-1',
        content: 'Review the definition of ready with the PO',
        priority: 'medium',
        dueOn: '2026-09-29',
        isOverdue: true,
        assignee: {
            id: 'member-0',
            kind: 'member',
            name: 'Arnaud Ritti',
            avatarUrl: avatar('0'),
            isTeamMember: true,
        },
        source: {
            retroTitle: 'Sprint 41 retrospective',
            retroCreatedAt: null,
            retroUrl: '/retros/retro-3',
        },
    }),
    openItem({
        id: 'item-2',
        content: 'Automate the release changelog',
        priority: 'low',
        dueOn: '2026-09-26',
        isOverdue: true,
        source: {
            retroTitle: 'Sprint 40 retrospective',
            retroCreatedAt: null,
            retroUrl: '/retros/retro-4',
        },
    }),
];

const page: TeamPageProps = {
    workspace: { id: 'nordlys', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 'atlas', name: 'Atlas' },
    members,
    openActionItemCount: 7,
    templateCategories: [],
    topTemplates: [],
    catalogue: [],
    canCreateRetro: true,
    canSaveTemplate: false,
    icebreakerGames: [],
    gameOptions: [],
    canCreateGameRoom: true,
    roomLimit: 20,
    defaultPokerDeck: { deck: 'fibonacci', savedDeckId: null },
    pokerDeckOptions: [],
    canCreatePokerGame: true,
    pokerSources: [],
    pokerDecks: [],
    canCreateWhiteboard: true,
    surveys: [
        {
            id: 'survey-1',
            title: 'Team pulse — October',
            status: 'open',
            template: 'team_pulse',
            questionCount: 5,
            responseCount: 4,
            updatedAt: '2026-10-01T08:00:00+00:00',
            closedAt: null,
            facilitatorName: 'Camille Roux',
            canManage: true,
            url: '#survey-1',
        },
        {
            id: 'survey-2',
            title: 'Onboarding feedback',
            status: 'draft',
            template: null,
            questionCount: 1,
            responseCount: 0,
            updatedAt: '2026-09-29T08:00:00+00:00',
            closedAt: null,
            facilitatorName: 'Camille Roux',
            canManage: true,
            url: '#survey-2',
        },
        {
            id: 'survey-3',
            title: 'Health check — September',
            status: 'closed',
            template: 'health_check',
            questionCount: 6,
            responseCount: 9,
            updatedAt: '2026-09-30T08:00:00+00:00',
            closedAt: '2026-09-30T08:00:00+00:00',
            facilitatorName: 'Malik Kone',
            canManage: false,
            url: '#survey-3',
        },
    ],
    canCreateSurvey: true,
    surveyTemplates: [
        {
            key: null,
            name: 'Blank',
            description: 'Start with no question.',
            questionCount: 0,
        },
        {
            key: 'health_check',
            name: 'Health check',
            description: "The team's statements, scored 1 to 5.",
            questionCount: 6,
        },
        {
            key: 'team_pulse',
            name: 'Team pulse',
            description: 'Workload, recommendation, rituals and blockers.',
            questionCount: 5,
        },
    ],
    whiteboardGallery: [],
    moodTrend,
    latestHealthScore: 3.8,
    currentSprintNumber: 42,
    defaultRetroTemplate: null,
    retroFacilitators: [],
    suggestedFacilitatorId: null,
    facilitatorRotation: false,
    viewerRole: 'owner',
    viewerIsObserver: false,
    canManageRituals: true,
    schedule: {
        sprint: {
            id: 'sprint-42',
            number: 42,
            startsOn: '2026-09-21',
            endsOn: '2026-10-04',
        },
        nextRetro: { date: '2026-10-02', time: '14:00' },
    },
    hasSprints: true,
    activity,
    liveNow,
    recentSessions,
    hasSessions: true,
    openActionItems,
    overdueActionItemCount: 2,
};

function Example({
    name,
    label,
    children,
}: {
    name: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <div data-state={name} className="flex min-w-0 flex-col gap-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function TeamSection() {
    const { t } = useTrans();

    return (
        <div
            data-bench-section="team"
            className="mx-auto flex w-full max-w-page flex-col gap-10 p-4 md:p-6"
        >
            <Example name="manager" label={t('Team page, for a manager')}>
                <TeamPage {...page} />
            </Example>
            <Example
                name="empty"
                label={t(
                    'Team page sections, for a member of a team without sessions',
                )}
            >
                <div className="flex min-w-0 flex-col gap-8">
                    <TeamRetrosSection retros={[]} />
                    <TeamPokerSection
                        workspaceSlug="nordlys"
                        teamId="atlas"
                        games={[]}
                        presence={{}}
                    />
                    <TeamWhiteboardsSection
                        workspaceSlug="nordlys"
                        boards={[]}
                        templates={[]}
                    />
                    <TeamSurveysSection
                        workspaceSlug="nordlys"
                        teamId="atlas"
                        surveys={[]}
                        canCreateSurvey
                    />
                    <div className="max-w-90">
                        <TeamMembersCard
                            workspaceSlug="nordlys"
                            team={page.team}
                            members={members.slice(0, 3)}
                            availableMembers={[]}
                            canManage={false}
                        />
                    </div>
                </div>
            </Example>
            <Example
                name="health-member"
                label={t('Health check card, for a member who cannot manage')}
            >
                <div className="max-w-90">
                    <TeamHealthCard
                        workspaceSlug="nordlys"
                        teamId="atlas"
                        statements={healthStatements}
                        canManage={false}
                    />
                </div>
            </Example>
            <Example
                name="roti-single"
                label={t('ROTI card, for a team with one closed retro')}
            >
                <TeamRotiCard trend={moodTrend.slice(-1)} />
            </Example>
            <Example
                name="roti-empty"
                label={t('ROTI card, for a team without results')}
            >
                <TeamRotiCard trend={[]} />
            </Example>
            <Example
                name="roti-loading"
                label={t('ROTI card, while the trend loads')}
            >
                <TeamRotiCard />
            </Example>
            <Example
                name="trend-error"
                label={t('ROTI card, when the trend could not be loaded')}
            >
                <TeamRotiCard failed onRetry={() => {}} />
            </Example>
            <Example
                name="health-check-page"
                label={t('Health check page, for a manager')}
            >
                <TeamHealthCheckPage
                    workspace={page.workspace}
                    team={page.team}
                    canEditStatements
                    ritualsUrl="#"
                    canCreateSurvey
                    moodTrend={moodTrend}
                />
            </Example>
            <Example
                name="health-check-page-member"
                label={t(
                    'Health check page, for a member of a team without results',
                )}
            >
                <TeamHealthCheckPage
                    workspace={page.workspace}
                    team={page.team}
                    canEditStatements={false}
                    ritualsUrl="#"
                    canCreateSurvey
                    moodTrend={[]}
                />
            </Example>
            <Example
                name="presence-loading"
                label={t('Planning poker section, while the presence loads')}
            >
                <TeamPokerSection
                    workspaceSlug="nordlys"
                    teamId="atlas"
                    games={games}
                />
            </Example>
        </div>
    );
}
