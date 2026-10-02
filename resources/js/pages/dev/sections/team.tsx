import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { TeamHealthCard } from '@/components/teams/team-health-card';
import { TeamMembersCard } from '@/components/teams/team-members-card';
import { TeamMoodCard } from '@/components/teams/team-mood-card';
import { TeamPage } from '@/components/teams/team-page';
import type { TeamPageProps } from '@/components/teams/team-page';
import { TeamPokerSection } from '@/components/teams/team-poker-section';
import { TeamRetrosSection } from '@/components/teams/team-retros-section';
import { TeamWhiteboardsSection } from '@/components/teams/team-whiteboards-section';
import { useTrans } from '@/hooks/use-trans';
import type {
    PokerGameSummary,
    TeamHealthStatement,
    TeamMember,
    TeamMoodPoint,
} from '@/types';

export const group: BenchGroup = 'layouts';

function avatar(digit: string): string {
    return `/avatars/${digit.repeat(32)}.svg`;
}

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
    [37, 6.4, 7, 3.6, 8],
    [38, 6.9, 8, 3.9, 8],
    [39, null, 0, 3.4, 6],
    [40, 7.1, 8, 3.8, 9],
    [41, 7.8, 9, 4.1, 9],
].map(([sprint, mood, moodVoters, roti, rotiVoters]) => ({
    retroId: `retro-sprint-${sprint}`,
    title: `Sprint ${sprint} retrospective`,
    completedAt: '2026-09-18T08:00:00+00:00',
    url: `/retros/retro-sprint-${sprint}`,
    mood,
    moodVoters: moodVoters ?? 0,
    roti,
    rotiVoters: rotiVoters ?? 0,
}));

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
    canManageIntegrations: true,
    pokerDecks: [],
    whiteboards: [
        {
            id: 'board-1',
            title: 'Invite flow — user journey',
            updatedAt: '2026-09-24T08:00:00+00:00',
            facilitatorName: 'Inès Benali',
            canDelete: true,
        },
        {
            id: 'board-2',
            title: 'Realtime architecture',
            updatedAt: '2026-09-17T08:00:00+00:00',
            facilitatorName: 'Malik Kone',
            canDelete: false,
        },
        {
            id: 'board-3',
            title: 'Q4 roadmap brainstorm, with a name that does not fit',
            updatedAt: '2026-09-09T08:00:00+00:00',
            facilitatorName: 'Camille Roux',
            canDelete: true,
        },
    ],
    canCreateWhiteboard: true,
    whiteboardTemplates: [],
    whiteboardGallery: [],
    pokerPresence: { 'game-1': 4, 'game-2': 0 },
    moodTrend,
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
                name="mood-roti"
                label={t('Mood card, for a team that only has ROTI votes')}
            >
                <div className="max-w-90">
                    <TeamMoodCard
                        trend={moodTrend
                            .slice(-2)
                            .map((point) => ({ ...point, mood: null }))}
                    />
                </div>
            </Example>
            <Example
                name="mood-empty"
                label={t('Mood card, for a team without results')}
            >
                <div className="max-w-90">
                    <TeamMoodCard trend={[]} />
                </div>
            </Example>
            <Example
                name="mood-loading"
                label={t('Mood card, while the trend loads')}
            >
                <div className="max-w-90">
                    <TeamMoodCard />
                </div>
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
