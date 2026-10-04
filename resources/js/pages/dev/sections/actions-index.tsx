import { usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
    ownerOptions,
    toActionItemData,
    toActionItemOwner,
} from '@/components/action-items/action-item-adapters';
import { NewActionItemButton } from '@/components/action-items/action-item-create-dialog';
import type { ActionItemTeam } from '@/components/action-items/action-item-create-dialog';
import { ActionItemFilterBar } from '@/components/action-items/action-item-filters';
import { ActionItemFiltersDrawer } from '@/components/action-items/action-item-filters-drawer';
import { ActionItemsHeader } from '@/components/action-items/action-items-header';
import type { ActionItemCounts } from '@/components/action-items/action-items-header';
import { ActionItemsList } from '@/components/action-items/action-items-list';
import { ActionItemsPagination } from '@/components/action-items/action-items-pagination';
import { ActionItemsTable } from '@/components/action-items/action-items-table';
import type { ActionItemRowContext } from '@/components/action-items/action-items-table';
import { ItemDeleteConfirm } from '@/components/action-items/item-delete-confirm';
import { ItemSubtasks } from '@/components/action-items/item-subtasks';
import { activeFilterCount } from '@/components/action-items/use-action-item-filters';
import type {
    ActionItemFilterChanges,
    ActionItemFilters,
} from '@/components/action-items/use-action-item-filters';
import { ActionItemMutationsContext } from '@/components/action-items/use-action-item-mutations';
import type { ActionItemMutationsValue } from '@/components/action-items/use-action-item-mutations';
import { BenchOverlayStage } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { useActionItemLabels } from '@/components/skrum/action-item';
import { ActionSheet } from '@/components/skrum/action-sheet';
import { EmptyState } from '@/components/skrum/empty-state';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMinWidth } from '@/hooks/use-min-width';
import { useTrans } from '@/hooks/use-trans';
import { workspaceActionItemEndpoints } from '@/lib/action-items/endpoints';
import { groupItems } from '@/lib/action-items/grouping';
import type {
    ActionItemGroup,
    ActionItemGrouping,
} from '@/lib/action-items/grouping';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import type { ActionItem, ActionItemAssignee } from '@/lib/retro/types';
import type { ExportSource, ExternalLink } from '@/types/integrations';

export const group: BenchGroup = 'layouts';

/** The width from which the page shows the table instead of the list. */
const TableFrom = 1280;

/** The captures are taken on a fixed day: the due dates never move. */
const Today = '2026-10-02';

const Here = '/dev/design-system/actions-index';

function avatar(digit: string): string {
    return `/avatars/${digit.repeat(32)}.svg`;
}

/** Names and titles come from the server, already in the user's language. */
const longName =
    'Maximilienne-Alexandrine de La Rochefoucauld-Montmorency-Laval';

const teams: ActionItemTeam[] = [
    {
        id: 'atlas',
        name: 'Atlas',
        members: [
            { id: 'u1', name: 'Inès Benali', avatarUrl: avatar('1') },
            { id: 'u2', name: 'Malik Kone', avatarUrl: avatar('2') },
            { id: 'u3', name: longName, avatarUrl: avatar('3') },
        ],
    },
    {
        id: 'boreal',
        name: 'Boréal',
        members: [
            { id: 'u4', name: 'Sofia Lindqvist', avatarUrl: avatar('4') },
        ],
    },
];

function member(teamIndex: number, memberIndex: number): ActionItemAssignee {
    return {
        ...teams[teamIndex].members[memberIndex],
        kind: 'member',
        isTeamMember: true,
    };
}

function link(
    id: string,
    source: ExternalLink['source'],
    key: string,
    extra: Partial<ExternalLink> = {},
): ExternalLink {
    return {
        id,
        source,
        key,
        url: `https://example.com/${key}`,
        state: 'open',
        statusName: null,
        syncState: 'synced',
        syncError: null,
        lastSyncedAt: '2026-10-01T08:00:00Z',
        ...extra,
    };
}

const sprint42 = {
    retroTitle: 'Sprint 42 retrospective',
    retroCreatedAt: '2026-09-25T08:00:00Z',
    retroUrl: Here,
};

const base: ActionItem = {
    id: 'a1',
    retroId: 'retro-42',
    teamId: 'atlas',
    cardId: null,
    content: 'Limit pull requests to 400 lines and add a review template',
    priority: 'high',
    dueOn: '2026-10-10',
    isOverdue: false,
    status: 'open',
    completedAt: null,
    startedAt: null,
    completedVia: null,
    assignee: member(0, 0),
    createdBy: { name: 'Malik Kone', avatarUrl: avatar('2') },
    isMine: true,
    commentCount: 3,
    source: sprint42,
    themeId: 'theme-1',
    themeName: 'Code review',
    recurrence: null,
    previousOccurrenceId: null,
    subtasks: [
        {
            id: 's1',
            content: 'Write the template',
            isCompleted: true,
            position: 0,
        },
        {
            id: 's2',
            content: 'Add the size check to the pipeline',
            isCompleted: false,
            position: 1,
        },
        {
            id: 's3',
            content: 'Tell the three squads',
            isCompleted: false,
            position: 2,
        },
    ],
    createdAt: '2026-09-25T09:00:00Z',
    externalLinks: [
        link('l1', 'jira', 'ATLAS-1287', { statusName: 'In review' }),
    ],
};

const items: ActionItem[] = [
    base,
    {
        ...base,
        id: 'a2',
        content: 'Fix the flaky end-to-end tests of the checkout',
        priority: 'medium',
        dueOn: '2026-09-26',
        isOverdue: true,
        assignee: member(0, 1),
        isMine: false,
        commentCount: 1,
        subtasks: [],
        externalLinks: [
            link('l2', 'linear', 'ENG-42', {
                syncState: 'failed',
                syncError: 'Token expired',
            }),
        ],
    },
    {
        ...base,
        id: 'a3',
        content: 'Rotate the on-call handover every Monday',
        priority: 'medium',
        dueOn: '2026-10-05',
        recurrence: 'weekly',
        previousOccurrenceId: 'a0',
        assignee: {
            id: 'p1',
            name: 'Carol Guest',
            avatarUrl: avatar('5'),
            kind: 'guest',
            isTeamMember: false,
        },
        isMine: false,
        commentCount: 0,
        subtasks: [],
        externalLinks: [],
    },
    {
        ...base,
        id: 'a4',
        teamId: 'boreal',
        retroId: null,
        source: null,
        themeId: null,
        themeName: null,
        content: 'Book the room for the quarterly planning',
        priority: 'low',
        dueOn: null,
        assignee: null,
        isMine: false,
        commentCount: 0,
        subtasks: [],
        externalLinks: [],
    },
    {
        ...base,
        id: 'a5',
        teamId: 'boreal',
        content:
            'Rewrite the deployment checklist so that every release names an owner, a rollback plan, a communication channel and the dashboards to watch, then review it with the three squads before the end of the quarter',
        priority: 'high',
        dueOn: '2026-11-20',
        recurrence: 'every_two_weeks',
        assignee: { ...member(0, 2), isTeamMember: false },
        isMine: false,
        commentCount: 200,
        externalLinks: [
            link('l3', 'jira_dc', 'PLATFORM-90412', { syncState: 'missing' }),
            link('l4', 'github', 'design-system#2048', {
                syncState: 'pending',
            }),
            link('l5', 'linear', 'INFRASTRUCTURE-1024'),
        ],
    },
    {
        ...base,
        id: 'a6',
        content: 'Archive the old release notes',
        priority: 'low',
        dueOn: '2026-09-30',
        status: 'completed',
        completedAt: '2026-09-29T15:00:00Z',
        completedVia: 'jira',
        assignee: member(0, 1),
        isMine: false,
        commentCount: 0,
        subtasks: [],
        externalLinks: [link('l6', 'jira', 'ATLAS-1190', { state: 'done' })],
    },
];

/** A row carries its id in the document: each state gets its own. */
function copies(prefix: string, source: ActionItem[] = items): ActionItem[] {
    return source.map((item) => ({ ...item, id: `${prefix}-${item.id}` }));
}

const exportSources: ExportSource[] = [
    { source: 'jira', label: 'Jira', integrationId: 'integration-1' },
];

const manager: ActionItemViewer = {
    userId: 'u1',
    participantId: null,
    isWorkspaceManager: true,
    facilitatedRetroIds: [],
    reviewTeamIds: [],
};

const counts: ActionItemCounts = {
    open: 28,
    overdue: 4,
    completed: 61,
    mine: 7,
    rituals: 9,
};

const defaultFilters: ActionItemFilters = {
    status: ['todo', 'doing'],
    priority: [],
    due: null,
    source: null,
    assignee: null,
    team: null,
    item: null,
};

/**
 * The bench has no server behind it: a request of a sub-task or of an export
 * fails, and the failure stays silent.
 */
const mutations: ActionItemMutationsValue = {
    endpoints: workspaceActionItemEndpoints('nordlys'),
    run: async (request) => {
        try {
            return await request;
        } catch {
            return undefined;
        }
    },
    onSaved: () => {},
};

type Overlay = { kind: 'sheet' | 'deleted' | 'delete'; item: ActionItem };

/** `?overlay=delete` and `?overlay=deleted` open another overlay than the sheet. */
function initialOverlay(item: ActionItem): Overlay {
    const asked =
        typeof window === 'undefined'
            ? null
            : new URLSearchParams(window.location.search).get('overlay');

    if (asked === 'delete' || asked === 'deleted') {
        return { kind: asked, item };
    }

    return { kind: 'sheet', item };
}

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

/** The table from 80rem of viewport and the list below, as the page mounts them. */
function Listing({
    groups,
    context,
    paged = false,
    loading = false,
    empty,
    pagination,
    label,
    onOpen,
}: {
    groups: ActionItemGroup[];
    context: ActionItemRowContext;
    paged?: boolean;
    loading?: boolean;
    empty?: ReactNode;
    pagination?: (className: string) => ReactNode;
    label: string;
    onOpen: (item: ActionItem) => void;
}) {
    const wide = useMinWidth(TableFrom);

    if (wide) {
        return (
            <ActionItemsTable
                groups={groups}
                context={context}
                paged={paged}
                loading={loading}
                empty={empty}
                footer={pagination?.('border-t')}
                aria-label={label}
                onOpen={onOpen}
            />
        );
    }

    if (groups.length === 0) {
        return empty;
    }

    return (
        <>
            <ActionItemsList
                groups={groups}
                context={context}
                endpoints={mutations.endpoints}
                paged={paged}
                aria-label={label}
                onPatch={() => {}}
            />
            {pagination?.('rounded-xl border bg-card shadow-card')}
        </>
    );
}

export default function ActionsIndexSection() {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const labels = useActionItemLabels();
    const isMobile = useIsMobile();
    const [rows, setRows] = useState(() => copies('page'));
    const [grouping, setGrouping] = useState<ActionItemGrouping>('none');
    const [filters, setFilters] = useState<ActionItemFilters>({
        ...defaultFilters,
        team: 'atlas',
    });
    const [overlay, setOverlay] = useState<Overlay | null>(() =>
        initialOverlay({ ...items[1], id: 'overlay-a2', isMine: true }),
    );
    const teamsById = useMemo(
        () => new Map(teams.map((team) => [team.id, team])),
        [],
    );

    const contextFor = (
        viewer: ActionItemViewer,
        showTeam: boolean,
    ): ActionItemRowContext => ({
        viewer,
        locale,
        today: Today,
        showTeam,
        teamName: (teamId) => teamsById.get(teamId)?.name,
        membersOf: (teamId) =>
            ownerOptions(teamsById.get(teamId)?.members ?? []),
        scope: { workspace: 'nordlys', canManagePeople: true },
        sourcesOf: () => exportSources,
        busyId: null,
        onStatusChange: (item, status) =>
            setRows((current) =>
                current.map((row) =>
                    row.id === item.id
                        ? {
                              ...row,
                              status,
                              isOverdue: false,
                              completedAt:
                                  status === 'completed'
                                      ? `${Today}T12:00:00Z`
                                      : null,
                          }
                        : row,
                ),
            ),
        onDelete: (item) => setOverlay({ kind: 'delete', item }),
        onRetrySync: () => {},
    });

    const context = contextFor(manager, filters.team === null);
    const allTeams = contextFor(manager, true);
    const memberContext = contextFor(
        { ...manager, userId: 'u9', isWorkspaceManager: false },
        false,
    );
    const open = (item: ActionItem): void =>
        setOverlay({ kind: 'sheet', item });

    const grouped = (
        source: ActionItem[],
        by: ActionItemGrouping,
    ): ActionItemGroup[] =>
        groupItems(source, by, {
            team: (teamId) => teamsById.get(teamId)?.name ?? t('Team'),
            assignee: (assignee) => {
                const owner = toActionItemOwner(assignee);

                return owner === null
                    ? t('Unassigned')
                    : labels.ownerName(owner);
            },
        });

    const isDefault = activeFilterCount(filters) === 0;
    const filterBar = {
        filters,
        teams,
        assignees: teams.flatMap((team) => team.members),
        overdueCount: counts.overdue,
        isDefault,
        onChange: (changes: ActionItemFilterChanges) =>
            setFilters((current) => ({ ...current, ...changes })),
        onReset: () => setFilters(defaultFilters),
    };

    const emptyDefault = (
        <EmptyState
            module="actions"
            title={t('No open action items.')}
            description={t(
                'Action items created in a retro or added here are listed on this page.',
            )}
        />
    );
    const emptyFiltered = (
        <EmptyState
            module="actions"
            title={t('Nothing matches these filters.')}
            description={t('Change the filters or reset them to see more.')}
            action={{
                label: t('Reset'),
                variant: 'outline',
                onClick: () => {},
            }}
        />
    );

    const sheetItem = overlay?.kind === 'delete' ? null : overlay?.item;
    const sheetData =
        sheetItem &&
        toActionItemData(sheetItem, {
            locale,
            viewer: manager,
            teamName: teamsById.get(sheetItem.teamId)?.name,
        });

    return (
        <ActionItemMutationsContext value={mutations}>
            <div className="mx-auto flex w-full max-w-page flex-col gap-10 p-4 md:p-6">
                <Example
                    name="page"
                    label={t(
                        'Action items page, for a manager: counters, filters, rows',
                    )}
                >
                    <div className="flex min-w-0 justify-end">
                        <NewActionItemButton onClick={() => {}} />
                    </div>
                    <div className="flex min-w-0 flex-col gap-4">
                        <ActionItemsHeader
                            counts={counts}
                            grouping={grouping}
                            onGroupingChange={setGrouping}
                        />
                        {isMobile ? (
                            <ActionItemFiltersDrawer
                                {...filterBar}
                                counts={counts}
                                activeCount={activeFilterCount(filters)}
                            />
                        ) : (
                            <ActionItemFilterBar {...filterBar} />
                        )}
                        <Listing
                            groups={grouped(rows, grouping)}
                            context={context}
                            paged
                            label={t('Action items')}
                            pagination={(className) => (
                                <ActionItemsPagination
                                    currentPage={2}
                                    lastPage={3}
                                    prevPageUrl={Here}
                                    nextPageUrl={Here}
                                    className={className}
                                />
                            )}
                            onOpen={open}
                        />
                    </div>
                </Example>
                <Example
                    name="grouped-team"
                    label={t('Rows of every team, grouped by team')}
                >
                    <Listing
                        groups={grouped(copies('team'), 'team')}
                        context={allTeams}
                        label={t('Rows of every team, grouped by team')}
                        onOpen={open}
                    />
                </Example>
                <Example
                    name="grouped-assignee"
                    label={t(
                        'Rows grouped by assignee, on a list of several pages',
                    )}
                >
                    <Listing
                        groups={grouped(copies('assignee'), 'assignee')}
                        context={allTeams}
                        paged
                        label={t(
                            'Rows grouped by assignee, on a list of several pages',
                        )}
                        onOpen={open}
                    />
                </Example>
                <Example
                    name="counters"
                    label={t('Counters at their longest, and one ritual')}
                >
                    <ActionItemsHeader
                        counts={{ ...counts, open: 1284, overdue: 312 }}
                        grouping="team"
                        onGroupingChange={() => {}}
                    />
                    <ActionItemsHeader
                        counts={{ ...counts, open: 1, overdue: 0, rituals: 1 }}
                        grouping="none"
                        onGroupingChange={() => {}}
                    />
                </Example>
                <Example
                    name="filters"
                    label={t('Filters: every facet on, only what is overdue')}
                >
                    <ActionItemFilterBar
                        {...filterBar}
                        filters={{
                            ...defaultFilters,
                            due: 'overdue',
                            assignee: 'u3',
                            team: 'atlas',
                        }}
                        isDefault={false}
                        onChange={() => {}}
                        onReset={() => {}}
                    />
                </Example>
                <Example
                    name="overdue"
                    label={t('Overdue, due in three days, done')}
                >
                    <Listing
                        groups={grouped(
                            copies('overdue', [items[1], items[2], items[5]]),
                            'none',
                        )}
                        context={context}
                        label={t('Overdue, due in three days, done')}
                        onOpen={open}
                    />
                </Example>
                <Example
                    name="member"
                    label={t('Rows of a member who manages none of them')}
                >
                    <Listing
                        groups={grouped(
                            copies(
                                'member',
                                items.map((item) => ({
                                    ...item,
                                    isMine: false,
                                })),
                            ),
                            'none',
                        )}
                        context={memberContext}
                        label={t('Rows of a member who manages none of them')}
                        onOpen={open}
                    />
                </Example>
                <Example name="empty" label={t('No action item yet')}>
                    <Listing
                        groups={[]}
                        context={context}
                        empty={emptyDefault}
                        label={t('No action item yet')}
                        onOpen={open}
                    />
                </Example>
                <Example
                    name="empty-filtered"
                    label={t('No action item under the filters')}
                >
                    <Listing
                        groups={[]}
                        context={context}
                        empty={emptyFiltered}
                        label={t('No action item under the filters')}
                        onOpen={open}
                    />
                </Example>
                <Example
                    name="loading"
                    label={t(
                        'While a filter loads: the table shows placeholder rows, the list stays',
                    )}
                >
                    <Listing
                        groups={grouped(copies('loading'), 'none')}
                        context={context}
                        loading
                        label={t(
                            'While a filter loads: the table shows placeholder rows, the list stays',
                        )}
                        onOpen={open}
                    />
                </Example>
                <BenchOverlayStage>
                    <Example
                        name="overlay"
                        label={t(
                            'Real overlay, open: pick a state to reopen it',
                        )}
                    >
                        <div className="flex min-w-0 flex-wrap gap-2">
                            {(
                                [
                                    ['sheet', t('Details of an overdue item')],
                                    [
                                        'deleted',
                                        t(
                                            'Details of an item deleted elsewhere',
                                        ),
                                    ],
                                    ['delete', t('Delete confirmation')],
                                ] as const
                            ).map(([kind, label]) => (
                                <Button
                                    key={kind}
                                    type="button"
                                    size="sm"
                                    variant={
                                        overlay?.kind === kind
                                            ? 'default'
                                            : 'outline'
                                    }
                                    data-overlay={kind}
                                    className="max-w-full min-w-0"
                                    onClick={() =>
                                        setOverlay({
                                            kind,
                                            item: {
                                                ...items[1],
                                                id: 'overlay-a2',
                                                isMine: true,
                                            },
                                        })
                                    }
                                >
                                    <span className="truncate">{label}</span>
                                </Button>
                            ))}
                        </div>
                    </Example>
                </BenchOverlayStage>
                {sheetItem && sheetData && (
                    <ActionSheet
                        {...sheetData}
                        open
                        onOpenChange={(next) => {
                            if (!next) {
                                setOverlay(null);
                            }
                        }}
                        today={Today}
                        deleted={overlay?.kind === 'deleted'}
                        members={ownerOptions(
                            teamsById.get(sheetItem.teamId)?.members ?? [],
                        )}
                        comments={
                            <p className="text-body-sm text-muted-foreground">
                                {t(
                                    'The comment thread is rendered here by the page.',
                                )}
                            </p>
                        }
                        onStatusChange={() => {}}
                        onChange={() => {}}
                        onDelete={() =>
                            setOverlay({ kind: 'delete', item: sheetItem })
                        }
                        onRetrySync={() => {}}
                    >
                        <ItemSubtasks
                            item={{ ...sheetItem, subtasks: base.subtasks }}
                            endpoints={mutations.endpoints}
                            canManage={overlay?.kind !== 'deleted'}
                            canComplete={overlay?.kind !== 'deleted'}
                        />
                    </ActionSheet>
                )}
                <ItemDeleteConfirm
                    item={overlay?.kind === 'delete' ? overlay.item : null}
                    onCancel={() => setOverlay(null)}
                    onConfirm={async () => setOverlay(null)}
                />
            </div>
        </ActionItemMutationsContext>
    );
}
