import { router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
    ownerOptions,
    toActionItemOwner,
} from '@/components/action-items/action-item-adapters';
import { ActionItemCreateDialog } from '@/components/action-items/action-item-create-dialog';
import type { ActionItemTeam } from '@/components/action-items/action-item-create-dialog';
import { ActionItemExtraFacets } from '@/components/action-items/action-item-facets';
import { ActionItemFilterBar } from '@/components/action-items/action-item-filters';
import { ActionItemFiltersDrawer } from '@/components/action-items/action-item-filters-drawer';
import {
    ActionItemSelectCell,
    ActionItemSelectGroup,
    ActionItemSelectHead,
} from '@/components/action-items/action-item-select-cell';
import { ActionItemSheet } from '@/components/action-items/action-item-sheet';
import { ActionItemsBulkBar } from '@/components/action-items/action-items-bulk-bar';
import { ActionItemsHeader } from '@/components/action-items/action-items-header';
import type { ActionItemCounts } from '@/components/action-items/action-items-header';
import { ActionItemsList } from '@/components/action-items/action-items-list';
import { ActionItemsPagination } from '@/components/action-items/action-items-pagination';
import { ActionItemsTable } from '@/components/action-items/action-items-table';
import type { ActionItemRowContext } from '@/components/action-items/action-items-table';
import { ItemDeleteConfirm } from '@/components/action-items/item-delete-confirm';
import {
    filterQuery,
    isDefaultStatus,
    useActionItemFilters,
} from '@/components/action-items/use-action-item-filters';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import {
    ActionItemMutationsContext,
    useActionItemMutations,
} from '@/components/action-items/use-action-item-mutations';
import {
    reloadActionItems,
    replaceActionItem,
    useActionItemsRealtime,
} from '@/components/action-items/use-action-items-realtime';
import { useActionItemSelection } from '@/components/action-items/use-action-item-selection';
import { useActionItemLabels } from '@/components/skrum/action-item';
import { EmptyState } from '@/components/skrum/empty-state';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMinWidth } from '@/hooks/use-min-width';
import { useTrans } from '@/hooks/use-trans';
import { localToday } from '@/lib/action-items/due';
import { workspaceActionItemEndpoints } from '@/lib/action-items/endpoints';
import { groupItems } from '@/lib/action-items/grouping';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import { countActionItemComments } from '@/lib/retro/board-reducer';
import type { ActionItem } from '@/lib/retro/types';
import type { ExportSource, WorkspaceSummary } from '@/types';

/** The table needs this much room for its seven columns beside the sidebar. */
const TableFrom = 1280;

export type ActionItemsPageProps = {
    workspace: WorkspaceSummary;
    filters: ActionItemFilters;
    items: {
        data: ActionItem[];
        currentPage: number;
        lastPage: number;
        total: number;
        prevPageUrl: string | null;
        nextPageUrl: string | null;
    };
    focusedItem: ActionItem | null;
    filterTeams: ActionItemTeam[];
    counts: ActionItemCounts;
    creatableTeams: ActionItemTeam[];
    assignees: { id: string; name: string }[];
    realtimeTeamIds: string[];
    exportSources: Record<string, ExportSource[]>;
    viewer: {
        userId: string;
        isWorkspaceManager: boolean;
        facilitatedRetroIds: string[];
        reviewTeamIds: string[];
    };
};

/**
 * Places left for the features that come after the rewrite. Each is a region
 * of the page; nothing is rendered while its slot is undefined.
 */
type ActionItemsPageSlots = {
    /** The selection box of a row, in the first column of the table (AI-1). */
    selectionCell?: (item: ActionItem) => ReactNode;
    /** The "select all" box, in the header of the first column (AI-1). */
    selectionHead?: ReactNode;
    /** The floating bar of the selected rows, under the table (AI-1). */
    bulkBar?: ReactNode;
    /** The facets after Assignee: priority, due date, source (AI-2). */
    extraFacets?: ReactNode;
};

type Props = ActionItemsPageProps & {
    /** The creation dialog is opened from the topbar, which the page owns. */
    creating: boolean;
    onCreatingChange: (creating: boolean) => void;
    slots?: ActionItemsPageSlots;
};

export function ActionItemsPage({
    workspace,
    filters,
    items,
    focusedItem,
    filterTeams,
    counts,
    creatableTeams,
    assignees,
    realtimeTeamIds,
    exportSources,
    viewer,
    creating,
    onCreatingChange,
    slots = {},
}: Props) {
    const { t } = useTrans();
    const labels = useActionItemLabels();
    const { locale, currentTeam } = usePage().props;
    const wide = useMinWidth(TableFrom);
    const isMobile = useIsMobile();
    const [opened, setOpened] = useState<ActionItem | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState<ActionItem | null>(null);
    const [selecting, setSelecting] = useState(false);
    const endpoints = useMemo(
        () => workspaceActionItemEndpoints(workspace.slug),
        [workspace.slug],
    );
    const teamsById = useMemo(
        () => new Map(filterTeams.map((team) => [team.id, team])),
        [filterTeams],
    );
    const avatars = useMemo(
        () =>
            new Map(
                filterTeams.flatMap((team) =>
                    team.members.map(
                        (member) => [member.id, member.avatarUrl] as const,
                    ),
                ),
            ),
        [filterTeams],
    );
    const actionViewer: ActionItemViewer = {
        userId: viewer.userId,
        participantId: null,
        isWorkspaceManager: viewer.isWorkspaceManager,
        facilitatedRetroIds: viewer.facilitatedRetroIds,
        reviewTeamIds: viewer.reviewTeamIds,
    };

    const filtering = useActionItemFilters({
        workspace,
        filters,
        currentTeamId: currentTeam?.id ?? null,
        teamIds: filterTeams.map((team) => team.id),
    });

    const realtime = useActionItemsRealtime({
        items: items.data,
        focusedItem,
        realtimeTeamIds,
        onSaved: (item) =>
            setOpened((current) =>
                current === null ? null : replaceActionItem([current], item)[0],
            ),
        onDeleted: (actionItemId) =>
            setDeletedIds((current) => new Set(current).add(actionItemId)),
        onComments: (actionItemId, commentCount, refresh) =>
            setOpened((current) =>
                current === null
                    ? null
                    : countActionItemComments(
                          [current],
                          actionItemId,
                          commentCount,
                          refresh,
                      )[0],
            ),
    });
    const { rows, focused } = realtime;

    const selection = useActionItemSelection({
        rows,
        viewer: actionViewer,
        total: items.total,
        filtersKey: JSON.stringify(filterQuery(filters)),
        pageKey: `${items.currentPage}:${filtering.grouping}`,
    });
    const { count: selectedCount, clear: clearSelection } = selection;

    const changeSelecting = (on: boolean): void => {
        setSelecting(on);

        if (!on) {
            clearSelection();
        }
    };

    // A long press enters selection mode with its item selected (spec 24 §9.5).
    const selectByLongPress = (item: ActionItem): void => {
        setSelecting(true);

        if (selection.selectable(item) && !selection.isSelected(item.id)) {
            selection.toggle(item.id);
        }
    };

    // Escape leaves the selection once nothing else is open: a sheet, a
    // menu or a dialog closes first on the same key.
    useEffect(() => {
        if (selectedCount === 0) {
            return;
        }

        const leave = (event: KeyboardEvent): void => {
            if (event.key !== 'Escape' || event.defaultPrevented) {
                return;
            }

            if (
                document.querySelector(
                    '[role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper]',
                ) !== null
            ) {
                return;
            }

            clearSelection();
        };

        document.addEventListener('keydown', leave);

        return () => document.removeEventListener('keydown', leave);
    }, [selectedCount, clearSelection]);

    const mutations = useActionItemMutations(endpoints, realtime.saveRow, {
        resync: reloadActionItems,
        onRemoved: (actionItemId) => {
            realtime.removeRow(actionItemId);

            if (opened?.id === actionItemId) {
                setSheetOpen(false);
            }
        },
        onCommentCount: (actionItemId, commentCount) =>
            realtime.countComments(actionItemId, commentCount, false),
    });

    // The sheet shows the row of the list while it is there, and what it
    // last knew of an item that left the list: a completed item leaves the
    // open ones without being deleted.
    const listed =
        opened === null
            ? null
            : (rows.find((row) => row.id === opened.id) ??
              (focused?.id === opened.id ? focused : null));
    const sheetItem = listed ?? opened;

    const open = (item: ActionItem): void => {
        setOpened(item);
        setSheetOpen(true);
    };

    const linkedId = filters.item;

    useEffect(() => {
        if (linkedId === null) {
            return;
        }

        document
            .getElementById(`action-item-${linkedId}`)
            ?.scrollIntoView({ block: 'center' });
    }, [linkedId]);

    const [linkedOpened, setLinkedOpened] = useState<string | null>(null);

    if (linkedId === null && linkedOpened !== null) {
        setLinkedOpened(null);
    }

    // A deep link opens the details of its item, once per link.
    if (wide && linkedId !== null && linkedOpened !== linkedId) {
        const linked =
            rows.find((row) => row.id === linkedId) ??
            (focused?.id === linkedId ? focused : null);

        setLinkedOpened(linkedId);

        if (linked) {
            setOpened(linked);
            setSheetOpen(true);
        }
    }

    const context: ActionItemRowContext = {
        viewer: actionViewer,
        locale,
        today: localToday(),
        showTeam: filters.team === null,
        teamName: (teamId) => teamsById.get(teamId)?.name,
        membersOf: (teamId) =>
            ownerOptions(teamsById.get(teamId)?.members ?? []),
        scope: {
            workspace: workspace.slug,
            canManagePeople: viewer.isWorkspaceManager,
        },
        sourcesOf: (teamId) => exportSources[teamId] ?? [],
        busyId: mutations.busyId,
        onStatusChange: (item, status) =>
            void mutations.setStatus(item, status),
        onDelete: setDeleting,
        onRetrySync: (item, link) => void mutations.retrySync(item, link),
    };

    const groups = groupItems(rows, filtering.grouping, {
        team: (teamId) => teamsById.get(teamId)?.name ?? t('Team'),
        assignee: (assignee) => {
            const owner = toActionItemOwner(assignee);

            return owner === null ? t('Unassigned') : labels.ownerName(owner);
        },
    });
    const paged = items.lastPage > 1;
    const focusedOutsideList =
        focused !== null && !rows.some((row) => row.id === focused.id);

    const filterBar = {
        filters,
        teams: filterTeams,
        assignees: assignees.map((assignee) => ({
            ...assignee,
            avatarUrl: avatars.get(assignee.id) ?? null,
        })),
        overdueCount: counts.overdue,
        isDefault: filtering.isDefault,
        onChange: filtering.apply,
        onReset: filtering.reset,
        extraFacets: slots.extraFacets ?? (
            <ActionItemExtraFacets
                filters={filters}
                onChange={filtering.apply}
            />
        ),
    };

    // The team is where the page lands, not a filter the viewer set: a
    // team without open items has none, it does not fail to match.
    const nothingOpen =
        isDefaultStatus(filters.status) &&
        filters.due === null &&
        filters.priority.length === 0 &&
        filters.source === null &&
        filters.assignee === null;

    const empty = (
        <EmptyState
            module="actions"
            title={
                nothingOpen
                    ? t('No open action items.')
                    : t('Nothing matches these filters.')
            }
            description={
                nothingOpen
                    ? t(
                          'Action items created in a retro or added here are listed on this page.',
                      )
                    : t('Change the filters or reset them to see more.')
            }
            action={
                nothingOpen
                    ? undefined
                    : {
                          label: t('Reset'),
                          variant: 'outline',
                          onClick: filtering.reset,
                      }
            }
        />
    );

    const pagination = (className: string) =>
        paged && (
            <ActionItemsPagination
                currentPage={items.currentPage}
                lastPage={items.lastPage}
                prevPageUrl={items.prevPageUrl}
                nextPageUrl={items.nextPageUrl}
                className={className}
            />
        );

    const list = (shown: typeof groups, label?: string, selectable = false) =>
        wide ? (
            <ActionItemsTable
                groups={shown}
                context={context}
                paged={paged}
                aria-label={label}
                onOpen={open}
            />
        ) : (
            <ActionItemsList
                groups={shown}
                context={context}
                endpoints={endpoints}
                paged={paged}
                focusedId={linkedId}
                aria-label={label}
                onPatch={(item, patch) => void mutations.patch(item, patch)}
                {...(selectable && {
                    selection,
                    selecting,
                    onLongPress: selectByLongPress,
                })}
            />
        );

    return (
        <div
            data-slot="action-items-page"
            data-realtime={realtime.state}
            className="flex min-w-0 flex-col gap-4"
        >
            <ActionItemsHeader
                counts={counts}
                grouping={filtering.grouping}
                onGroupingChange={filtering.setGrouping}
                selecting={selecting}
                onSelectingChange={wide ? undefined : changeSelecting}
            />

            {isMobile ? (
                <ActionItemFiltersDrawer
                    {...filterBar}
                    counts={counts}
                    activeCount={filtering.activeCount}
                />
            ) : (
                <ActionItemFilterBar {...filterBar} />
            )}

            <ActionItemMutationsContext value={mutations.value}>
                {focusedOutsideList && focused && (
                    <section
                        data-slot="linked-action-item"
                        className="flex min-w-0 flex-col gap-2"
                    >
                        <h2 className="text-sm font-semibold">
                            {t('Linked action item')}
                        </h2>
                        {list(
                            [{ key: 'linked', label: '', items: [focused] }],
                            t('Linked action item'),
                        )}
                    </section>
                )}

                {wide && (
                    <ActionItemsTable
                        groups={groups}
                        context={context}
                        paged={paged}
                        loading={filtering.loading}
                        empty={empty}
                        footer={pagination('border-t')}
                        aria-label={t('Action items')}
                        selectionCell={
                            slots.selectionCell ??
                            ((item) => (
                                <ActionItemSelectCell
                                    item={item}
                                    selection={selection}
                                />
                            ))
                        }
                        selectionHead={
                            slots.selectionHead ?? (
                                <ActionItemSelectHead
                                    items={rows}
                                    selection={selection}
                                />
                            )
                        }
                        selectionGroup={(group) => (
                            <ActionItemSelectGroup
                                label={group.label}
                                items={group.items}
                                selection={selection}
                            />
                        )}
                        isSelected={(item) => selection.isSelected(item.id)}
                        onOpen={open}
                    />
                )}
                {!wide && groups.length === 0 && empty}
                {!wide && groups.length > 0 && (
                    <>
                        {list(groups, t('Action items'), true)}
                        {pagination('rounded-xl border bg-card shadow-card')}
                    </>
                )}
                {slots.bulkBar ?? (
                    <ActionItemsBulkBar
                        workspace={workspace.slug}
                        locale={locale}
                        items={rows}
                        selection={selection}
                        filters={filters}
                        teams={filterTeams}
                        viewer={actionViewer}
                        run={mutations.run}
                        onSaved={realtime.saveRow}
                        onRemoved={(actionItemId) => {
                            realtime.removeRow(actionItemId);

                            if (opened?.id === actionItemId) {
                                setSheetOpen(false);
                            }
                        }}
                        onReload={() =>
                            router.reload({ only: ['items', 'counts'] })
                        }
                        endpoints={endpoints}
                        scope={context.scope}
                        sourcesOf={context.sourcesOf}
                        layout={wide ? 'floating' : 'docked'}
                    />
                )}

                {sheetItem && (
                    <ActionItemSheet
                        item={sheetItem}
                        open={sheetOpen}
                        onOpenChange={setSheetOpen}
                        context={context}
                        endpoints={endpoints}
                        deleted={deletedIds.has(sheetItem.id)}
                        onPatch={(item, patch) =>
                            void mutations.patch(item, patch)
                        }
                    />
                )}
            </ActionItemMutationsContext>

            <ItemDeleteConfirm
                item={deleting}
                onCancel={() => setDeleting(null)}
                onConfirm={async (item) => {
                    await mutations.remove(item);
                    setDeleting(null);
                }}
            />

            {creating && creatableTeams.length > 0 && (
                <ActionItemCreateDialog
                    open={creating}
                    onOpenChange={onCreatingChange}
                    workspaceSlug={workspace.slug}
                    teams={creatableTeams}
                    defaultTeamId={filters.team}
                    run={mutations.run}
                    onCreated={reloadActionItems}
                />
            )}
        </div>
    );
}
