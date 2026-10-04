import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { CreateWorkspaceForm } from '@/components/workspaces/create-workspace-form';
import { DeleteWorkspaceSection } from '@/components/workspaces/delete-workspace-section';
import { LeaveWorkspacePanel } from '@/components/workspaces/leave-workspace-dialog';
import { MembersTable } from '@/components/workspaces/members-table';
import type { WorkspaceMembersProps } from '@/components/workspaces/members-table';
import { TemplatesPage } from '@/components/workspaces/templates-page';
import type { TemplatesPageProps } from '@/components/workspaces/templates-page';
import { WorkspaceOverview } from '@/components/workspaces/workspace-overview';
import type { WorkspaceOverviewProps } from '@/components/workspaces/workspace-overview';
import { useTrans } from '@/hooks/use-trans';
import type { WorkspaceRole, WorkspaceTeamTile } from '@/types';

export const group: BenchGroup = 'layouts';

/** The bench is drawn on a fixed day, so that "3 days ago" stays true in the captures. */
const Now = Date.parse('2026-10-02T12:00:00+00:00');

function avatar(digit: string): string {
    return `/avatars/${digit.repeat(32)}.svg`;
}

function members(names: string[], offset: number) {
    return names.map((name, index) => ({
        name,
        avatarUrl: avatar(((index + offset) % 10).toString()),
    }));
}

/** Names and titles come from the server, already in the user's language. */
const teams: WorkspaceTeamTile[] = [
    {
        id: 'team-atlas',
        name: 'Atlas',
        description: 'Product squad · retro app',
        membersCount: 9,
        members: members(
            [
                'Arnaud Ritti',
                'Camille Roux',
                'Théo Martin',
                'Inès Benali',
                'Malik Kone',
            ],
            0,
        ),
        isMember: true,
        activity: {
            openRetroTitle: 'Sprint 42 retro',
            lastRetroAt: '2026-09-18T10:00:00+00:00',
            openPokerGames: 3,
            openActionItems: 7,
            overdueActionItems: 2,
            openRetroSprint: 42,
            whiteboardsEditedToday: 0,
        },
    },
    {
        id: 'team-borealis',
        name: 'Borealis',
        description: 'Platform & infrastructure',
        membersCount: 8,
        members: members(
            ['Bao Lin', 'Hugo Petit', 'Yuki Tanaka', 'Noa Kim', 'Zoé Petit'],
            3,
        ),
        isMember: true,
        activity: {
            openRetroTitle: null,
            lastRetroAt: '2026-09-29T10:00:00+00:00',
            openPokerGames: 0,
            openActionItems: 4,
            overdueActionItems: 0,
            openRetroSprint: null,
            whiteboardsEditedToday: 1,
        },
    },
    {
        id: 'team-comet',
        name: 'Comet',
        description: null,
        membersCount: 1,
        members: members(['Lea Garnier'], 6),
        isMember: false,
        activity: {
            openRetroTitle: null,
            lastRetroAt: null,
            openPokerGames: 1,
            openActionItems: 0,
            overdueActionItems: 0,
            openRetroSprint: null,
            whiteboardsEditedToday: 0,
        },
    },
];

const workspace = {
    id: 'workspace-nordlys',
    name: 'Nordlys',
    slug: 'nordlys',
    description: 'Every product team of Nordlys, from the app to the platform.',
};

const page: WorkspaceOverviewProps = {
    workspace,
    teams,
    membersCount: 24,
    adminsCount: 2,
    otherAdminName: 'Camille Roux',
    canManage: true,
    canEditDetails: true,
};

const longNames: WorkspaceOverviewProps = {
    ...page,
    workspace: {
        ...workspace,
        name: 'Nordlys Engineering, Product, Design and Customer Operations of the Northern Europe business unit',
    },
    teams: [
        {
            ...teams[0],
            name: 'Platform reliability, observability and developer experience',
            activity: {
                ...teams[0].activity,
                openRetroTitle:
                    'Sprint 42 retrospective of the platform reliability team, with the incident review',
                openActionItems: 128,
                overdueActionItems: 37,
                openRetroSprint: null,
                whiteboardsEditedToday: 0,
            },
        },
        {
            ...teams[1],
            name: 'Maximilian-Alexander-von-Hohenberg-Lichtenstein',
            description: null,
            membersCount: 124,
        },
    ],
};

function person(name: string, role: WorkspaceRole, index: number) {
    return {
        id: `member-${index}`,
        name,
        email: `${name.toLowerCase().split(' ')[0]}@nordlys.example`,
        avatarUrl: avatar((index % 10).toString()),
        role,
    };
}

const memberList: WorkspaceMembersProps = {
    workspace,
    members: [
        person('Arnaud Ritti', 'owner', 0),
        person('Camille Roux', 'admin', 1),
        person('Ines Benali', 'admin', 2),
        person('Malik Kone', 'member', 3),
        person('Theo Martin', 'member', 4),
    ],
    invitations: [
        {
            id: 'invitation-1',
            email: 'lucas.p@nordlys.example',
            role: 'member',
            team: { id: 'team-atlas', name: 'Atlas' },
            teamRole: 'member',
            status: 'pending',
            isExpired: false,
            invitedAt: '2026-09-26T09:00:00+00:00',
        },
        {
            id: 'invitation-2',
            email: 'sofia.ortega@nordlys.example',
            role: 'admin',
            team: null,
            teamRole: null,
            status: 'expired',
            isExpired: true,
            invitedAt: '2026-09-12T09:00:00+00:00',
        },
    ],
    teams: [{ id: 'team-atlas', name: 'Atlas' }],
    teamRoles: ['facilitator', 'member', 'observer'],
    invitationValidForDays: 7,
    isOwner: true,
};

const longMemberList: WorkspaceMembersProps = {
    ...memberList,
    members: [
        memberList.members[0],
        {
            ...person('Maximilian', 'member', 5),
            name: 'Maximilian-Alexander von Hohenberg-Lichtenstein zu Sachsen-Coburg',
            email: 'maximilian-alexander.von.hohenberg-lichtenstein@northern-europe-business-unit.nordlys.example',
        },
    ],
    invitations: [
        {
            ...memberList.invitations[0],
            email: 'a.very.long.address.of.a.future.member@northern-europe-business-unit.nordlys.example',
        },
    ],
};

function author(name: string, digit: string) {
    return { name, avatarUrl: avatar(digit) };
}

const templates: TemplatesPageProps = {
    workspace,
    templates: [
        {
            id: 'template-1',
            name: '4L',
            category: 'essentials',
            author: author('Camille Roux', '4'),
            usageCount: 12,
            visibility: 'workspace',
            team: null,
            canManage: true,
            columns: [
                { title: 'Liked', description: null, color: 'moss' },
                { title: 'Learned', description: null, color: 'sky' },
                { title: 'Lacked', description: null, color: 'coral' },
                { title: 'Longed for', description: null, color: 'sun' },
            ],
        },
        {
            id: 'template-2',
            name: 'Start / Stop / Continue',
            category: 'essentials',
            author: author('Arnaud Ritti', '1'),
            usageCount: 9,
            visibility: 'team',
            team: { id: 'team-atlas', name: 'Atlas' },
            canManage: true,
            columns: [
                { title: 'Start', description: null, color: 'moss' },
                { title: 'Stop', description: null, color: 'coral' },
                { title: 'Continue', description: null, color: 'sky' },
            ],
        },
        {
            id: 'template-3',
            name: 'Mad / Sad / Glad',
            category: 'team_mood',
            author: author('Malik Kone', '6'),
            usageCount: 4,
            visibility: 'personal',
            team: null,
            canManage: false,
            columns: [
                { title: 'Mad', description: null, color: 'coral' },
                { title: 'Sad', description: null, color: 'iris' },
                { title: 'Glad', description: null, color: 'sun' },
            ],
        },
        {
            id: 'template-4',
            name: 'Sailboat',
            category: 'themed',
            author: null,
            usageCount: 2,
            visibility: 'workspace',
            team: null,
            canManage: true,
            columns: [
                { title: 'Wind', description: null, color: 'lagoon' },
                { title: 'Anchors', description: null, color: 'apricot' },
                { title: 'Rocks', description: null, color: 'plum' },
                { title: 'Island', description: null, color: 'moss' },
            ],
        },
    ],
    categories: [
        { value: 'essentials', label: 'Essentials' },
        { value: 'team_mood', label: 'Team & mood' },
        { value: 'themed', label: 'Themed' },
    ],
    whiteboardTemplates: [],
    pokerDecks: [
        {
            id: 'deck-1',
            name: 'Fibonacci + coffee',
            cards: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
            usageCount: 18,
            author: author('Camille Roux', '4'),
            canManage: true,
        },
        {
            id: 'deck-2',
            name: 'T-shirt sizing',
            cards: ['XS', 'S', 'M', 'L', 'XL', '?'],
            usageCount: 1,
            author: author('Bao Lin', '3'),
            canManage: true,
        },
    ],
    canCreatePokerDeck: true,
    canManage: true,
    canCreate: true,
    canShareWorkspace: true,
    teamTemplateTeams: [
        { id: 'team-atlas', name: 'Atlas' },
        { id: 'team-borealis', name: 'Borealis' },
    ],
    catalogue: [
        {
            key: 'went_well_to_improve_actions',
            name: 'Went well, To improve, Actions',
            category: 'essentials',
            isCommon: true,
            isWorkspace: false,
            columns: [
                {
                    title: 'Went well',
                    description: 'What helped us this sprint',
                    color: 'moss',
                },
                {
                    title: 'To improve',
                    description: 'What slowed us down',
                    color: 'coral',
                },
                {
                    title: 'Actions',
                    description: 'What we change next',
                    color: 'sky',
                },
            ],
        },
        {
            key: 'start_stop_continue',
            name: 'Start, Stop, Continue',
            category: 'essentials',
            isCommon: true,
            isWorkspace: false,
            columns: [
                { title: 'Start', description: null, color: 'moss' },
                { title: 'Stop', description: null, color: 'coral' },
                { title: 'Continue', description: null, color: 'sky' },
            ],
        },
        {
            key: 'sailboat',
            name: 'Sailboat',
            category: 'themed',
            isCommon: false,
            isWorkspace: false,
            columns: [
                { title: 'Wind', description: null, color: 'lagoon' },
                { title: 'Anchors', description: null, color: 'apricot' },
            ],
        },
    ],
};

const longTemplates: TemplatesPageProps = {
    ...templates,
    templates: [
        {
            ...templates.templates[0],
            name: 'Quarterly retrospective of the platform reliability, observability and developer experience teams',
            author: author(
                'Maximilian-Alexander von Hohenberg-Lichtenstein',
                '5',
            ),
            usageCount: 1284,
            columns: Array.from({ length: 10 }, (_, index) => ({
                title: `Observability and reliability ${index + 1}`,
                description: null,
                color: templates.templates[index % 4].columns[0].color,
            })),
        },
    ],
    pokerDecks: [
        {
            ...templates.pokerDecks[0],
            name: 'Fibonacci extended with halves, infinity and coffee',
            cards: Array.from({ length: 20 }, (_, index) => `${index * 13}`),
        },
    ],
    whiteboardTemplates: [
        {
            id: 'board-1',
            name: 'Kickoff map of the Northern Europe business unit',
            description:
                'Goals, risks, owners and the first milestones of a project, on one board',
            preview: {
                width: 400,
                height: 240,
                shapes: [
                    {
                        kind: 'text',
                        x: 20,
                        y: 20,
                        width: 160,
                        height: 24,
                        fill: null,
                        stroke: null,
                        points: [],
                    },
                    {
                        kind: 'text',
                        x: 20,
                        y: 80,
                        width: 360,
                        height: 120,
                        fill: null,
                        stroke: null,
                        points: [],
                    },
                ],
            },
            canManage: true,
        },
    ],
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

export default function WorkspaceSection() {
    const { t } = useTrans();

    return (
        <div
            data-bench-section="workspace"
            className="mx-auto flex w-full max-w-page flex-col gap-10 p-4 md:p-6"
        >
            <Example name="manager" label={t('Workspace page, for an admin')}>
                <WorkspaceOverview {...page} role="admin" now={Now} />
            </Example>
            <Example name="member" label={t('Workspace page, for a member')}>
                <WorkspaceOverview
                    {...page}
                    teams={teams.slice(0, 1)}
                    otherAdminName={null}
                    canManage={false}
                    canEditDetails={false}
                    role="member"
                    now={Now}
                />
            </Example>
            <Example
                name="empty-manager"
                label={t('Workspace page without a team, for the owner')}
            >
                <WorkspaceOverview
                    {...page}
                    teams={[]}
                    membersCount={1}
                    adminsCount={1}
                    otherAdminName={null}
                    role="owner"
                    now={Now}
                />
            </Example>
            <Example
                name="empty-member"
                label={t('Workspace page, for a member of no team')}
            >
                <WorkspaceOverview
                    {...page}
                    teams={[]}
                    otherAdminName={null}
                    canManage={false}
                    canEditDetails={false}
                    role="member"
                    now={Now}
                />
            </Example>
            <Example name="long" label={t('Workspace page, long names')}>
                <WorkspaceOverview {...longNames} role="admin" now={Now} />
            </Example>
            <Example
                name="leave"
                label={t('Leaving a workspace, the confirmation unfolded')}
            >
                <LeaveWorkspacePanel
                    open
                    autoFocus={false}
                    onOpenChange={() => {}}
                    workspace={workspace}
                    teams={['Atlas', 'Borealis', 'Comet']}
                    adminsCount={2}
                    otherAdminName="Camille Roux"
                />
            </Example>
            <Example name="members" label={t('Members page, for an owner')}>
                <MembersTable
                    {...memberList}
                    currentUserId="member-0"
                    invitationUrl="https://skrum.example/invitations/k3J9xPq7LmN2vB8sT4wY6zR1cD5fG0hA"
                />
            </Example>
            <Example
                name="members-admin"
                label={t('Members page, for an admin')}
            >
                <MembersTable
                    {...memberList}
                    invitations={[]}
                    isOwner={false}
                    currentUserId="member-1"
                />
            </Example>
            <Example name="members-long" label={t('Members page, long names')}>
                <MembersTable {...longMemberList} currentUserId="member-0" />
            </Example>
            <Example name="delete-workspace" label={t('Deleting a workspace')}>
                <DeleteWorkspaceSection workspace={workspace} />
            </Example>
            <Example name="create" label={t('Workspace creation')}>
                <CreateWorkspaceForm autoFocus={false} />
            </Example>
            <Example name="templates" label={t('Templates page, for an admin')}>
                <TemplatesPage {...templates} team="team-atlas" />
            </Example>
            <Example
                name="templates-member"
                label={t('Templates page, for a member')}
            >
                <TemplatesPage
                    {...templates}
                    pokerDecks={templates.pokerDecks.map((deck) => ({
                        ...deck,
                        canManage: false,
                    }))}
                    templates={templates.templates.map((template) => ({
                        ...template,
                        canManage: template.visibility === 'personal',
                    }))}
                    canCreatePokerDeck={false}
                    canManage={false}
                    canShareWorkspace={false}
                    teamTemplateTeams={[]}
                    team="team-atlas"
                />
            </Example>
            <Example
                name="templates-retro"
                label={t('Templates page, the Retro tab')}
            >
                <TemplatesPage
                    {...templates}
                    initialTab="retro"
                    team="team-atlas"
                />
            </Example>
            <Example
                name="templates-empty"
                label={t('Templates page of a new workspace, without a team')}
            >
                <TemplatesPage
                    {...templates}
                    templates={[]}
                    pokerDecks={[]}
                    team={null}
                />
            </Example>
            <Example
                name="templates-long"
                label={t('Templates page, long names')}
            >
                <TemplatesPage {...longTemplates} team={null} />
            </Example>
        </div>
    );
}
