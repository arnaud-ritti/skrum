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
import { DEFAULT_STROKE, POSTIT } from '@/lib/whiteboard/palette';
import type { PostItColor } from '@/lib/whiteboard/palette';
import type {
    PokerGameSummary,
    RecentSessionRow,
    TeamActivityLine,
    TeamHealthStatement,
    TeamMember,
    TeamMoodPoint,
    TeamRole,
    WhiteboardPreview,
    WhiteboardPreviewShape,
} from '@/types';

export const group: BenchGroup = 'layouts';

function avatar(digit: string): string {
    return `/avatars/${digit.repeat(32)}.svg`;
}

const memberRoles: TeamRole[] = ['owner', 'facilitator', 'member', 'observer'];

const sticky = (
    x: number,
    y: number,
    color: PostItColor,
): WhiteboardPreviewShape => ({
    kind: 'rect',
    x,
    y,
    width: 64,
    height: 52,
    fill: POSTIT[color].bg,
    stroke: POSTIT[color].stroke,
    points: [],
});

const boardPreview: WhiteboardPreview = {
    width: 320,
    height: 160,
    shapes: [
        sticky(20, 20, 'sun'),
        sticky(110, 34, 'sky'),
        sticky(200, 18, 'moss'),
        {
            kind: 'ellipse',
            x: 214,
            y: 100,
            width: 72,
            height: 36,
            fill: null,
            stroke: DEFAULT_STROKE,
            points: [],
        },
    ],
};

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
    moodVoters: moodVoters ?? 0,
    roti,
    rotiVoters: rotiVoters ?? 0,
    sprintLabel: `S${sprint}`,
}));

const recentSessions: RecentSessionRow[] = [
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
    availableMembers: [
        {
            id: 'available-1',
            name: 'Olga Nowak',
            email: 'olga.nowak@nordlys.example',
            avatarUrl: avatar('a'),
        },
    ],
    canManage: true,
    openActionItemCount: 7,
    retros: [
        {
            id: 'retro-1',
            title: 'Sprint 42 retrospective',
            phase: 'writing',
            phaseLabel: 'Writing',
            createdAt: '2026-09-30T08:00:00+00:00',
            templateName: '4L',
            facilitator: { name: 'Camille Roux', avatarUrl: avatar('1') },
            rotiAverage: null,
            viewerHasJoined: false,
            stats: { participants: 8, cards: 23, groups: 0, actionItems: 0 },
        },
        {
            id: 'retro-2',
            title: 'Q3 release post-mortem',
            phase: 'voting',
            phaseLabel: 'Voting',
            createdAt: '2026-09-29T08:00:00+00:00',
            templateName: 'Mad / Sad / Glad',
            facilitator: { name: 'Camille Roux', avatarUrl: avatar('1') },
            rotiAverage: null,
            viewerHasJoined: true,
            stats: { participants: 7, cards: 31, groups: 6, actionItems: 0 },
        },
        {
            id: 'retro-3',
            title: 'Sprint 41 retrospective',
            phase: 'completed',
            phaseLabel: 'Completed',
            createdAt: '2026-09-18T08:00:00+00:00',
            templateName: 'Start / Stop / Continue',
            facilitator: { name: 'Arnaud Ritti', avatarUrl: avatar('0') },
            rotiAverage: 4.1,
            viewerHasJoined: false,
            stats: { participants: 8, cards: 27, groups: 5, actionItems: 4 },
        },
        {
            id: 'retro-4',
            title: 'Sprint 40 retrospective',
            phase: 'completed',
            phaseLabel: 'Completed',
            createdAt: '2026-09-04T08:00:00+00:00',
            templateName: 'Sailboat',
            facilitator: null,
            rotiAverage: 3.8,
            viewerHasJoined: false,
            stats: { participants: 9, cards: 31, groups: 7, actionItems: 6 },
        },
    ],
    templateCategories: [],
    topTemplates: [],
    catalogue: [],
    canCreateRetro: true,
    healthStatements,
    canManageHealthStatements: true,
    llm: { enabled: false, provider: null },
    icebreakerGames: [],
    gameOptions: [],
    canCreateGameRoom: true,
    roomLimit: 20,
    pokerGames: games,
    defaultPokerDeck: { deck: 'fibonacci', savedDeckId: null },
    pokerDeckOptions: [],
    canCreatePokerGame: true,
    pokerSources: [],
    canManageIntegrations: true,
    pokerDecks: [],
    whiteboards: [
        {
            id: 'board-1',
            title: 'Invite flow — user journey',
            updatedAt: '2026-09-24T08:00:00+00:00',
            facilitatorName: 'Inès Benali',
            canDelete: true,
            preview: boardPreview,
        },
        {
            id: 'board-2',
            title: 'Realtime architecture',
            updatedAt: '2026-09-17T08:00:00+00:00',
            facilitatorName: 'Malik Kone',
            canDelete: false,
            preview: null,
        },
        {
            id: 'board-3',
            title: 'Q4 roadmap brainstorm, with a name that does not fit',
            updatedAt: '2026-09-09T08:00:00+00:00',
            facilitatorName: 'Camille Roux',
            canDelete: true,
            preview: null,
        },
    ],
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
    whiteboardTemplates: [],
    whiteboardGallery: [],
    pokerPresence: { 'game-1': 4, 'game-2': 0 },
    moodTrend,
    currentSprintNumber: 42,
    defaultRetroTemplate: null,
    retroFacilitators: [],
    suggestedFacilitatorId: null,
    facilitatorRotation: false,
    roleOptions: [
        { value: 'owner', label: 'Owner' },
        { value: 'facilitator', label: 'Facilitator' },
        { value: 'member', label: 'Member' },
        { value: 'observer', label: 'Observer' },
    ],
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
    recentSessions,
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
                    healthStatements={healthStatements}
                    canManageHealthStatements
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
                    healthStatements={healthStatements}
                    canManageHealthStatements={false}
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
