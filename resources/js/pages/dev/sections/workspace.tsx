import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { CreateWorkspaceForm } from '@/components/workspaces/create-workspace-form';
import { DeleteWorkspaceSection } from '@/components/workspaces/delete-workspace-section';
import { LeaveWorkspacePanel } from '@/components/workspaces/leave-workspace-dialog';
import { MembersTable } from '@/components/workspaces/members-table';
import type { WorkspaceMembersProps } from '@/components/workspaces/members-table';
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
            openRetroTitle: 'Sprint 42',
            lastRetroAt: '2026-09-18T10:00:00+00:00',
            openPokerGames: 3,
            openActionItems: 7,
            overdueActionItems: 2,
        },
    },
    {
        id: 'team-borealis',
        name: 'Borealis',
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
        },
    },
    {
        id: 'team-comet',
        name: 'Comet',
        membersCount: 1,
        members: members(['Lea Garnier'], 6),
        isMember: false,
        activity: {
            openRetroTitle: null,
            lastRetroAt: null,
            openPokerGames: 1,
            openActionItems: 0,
            overdueActionItems: 0,
        },
    },
];

const workspace = { id: 'workspace-nordlys', name: 'Nordlys', slug: 'nordlys' };

const page: WorkspaceOverviewProps = {
    workspace,
    teams,
    membersCount: 24,
    adminsCount: 2,
    otherAdminName: 'Camille Roux',
    canManage: true,
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
            },
        },
        {
            ...teams[1],
            name: 'Maximilian-Alexander-von-Hohenberg-Lichtenstein',
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
            isExpired: false,
            invitedAt: '2026-09-26T09:00:00+00:00',
        },
        {
            id: 'invitation-2',
            email: 'sofia.ortega@nordlys.example',
            role: 'admin',
            isExpired: true,
            invitedAt: '2026-09-12T09:00:00+00:00',
        },
    ],
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
        </div>
    );
}
