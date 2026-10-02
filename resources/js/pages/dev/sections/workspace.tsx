import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { CreateWorkspaceForm } from '@/components/workspaces/create-workspace-form';
import { LeaveWorkspacePanel } from '@/components/workspaces/leave-workspace-dialog';
import { WorkspaceOverview } from '@/components/workspaces/workspace-overview';
import type { WorkspaceOverviewProps } from '@/components/workspaces/workspace-overview';
import { useTrans } from '@/hooks/use-trans';
import type { WorkspaceTeamTile } from '@/types';

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
            <Example name="create" label={t('Workspace creation')}>
                <CreateWorkspaceForm autoFocus={false} />
            </Example>
        </div>
    );
}
