import { Head, Link, router, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import {
    ActionItemCard,
    type RunMutation,
} from '@/components/action-items/action-item-card';
import { ActionItemForm } from '@/components/action-items/action-item-form';
import {
    assigneeLabel,
    teamAssigneeGroups,
} from '@/components/action-items/assignee-select';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { workspaceActionItemEndpoints } from '@/lib/action-items/endpoints';
import { formatShortDate } from '@/lib/action-items/format';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import { countActionItemComments } from '@/lib/retro/board-reducer';
import type { ActionItem } from '@/lib/retro/types';
import type { WorkspaceSummary } from '@/types';

type StatusFilter = 'open' | 'overdue' | 'completed' | 'all';

type Filters = {
    status: StatusFilter;
    assignee: string | null;
    team: string | null;
    item: string | null;
};

type TeamOption = {
    id: string;
    name: string;
    members: Array<{ id: string; name: string; avatarUrl: string }>;
};

type Props = {
    workspace: WorkspaceSummary;
    filters: Filters;
    items: {
        data: ActionItem[];
        currentPage: number;
        lastPage: number;
        total: number;
        prevPageUrl: string | null;
        nextPageUrl: string | null;
    };
    focusedItem: ActionItem | null;
    teams: TeamOption[];
    creatableTeams: TeamOption[];
    assignees: Array<{ id: string; name: string }>;
    realtimeTeamIds: string[];
    viewer: {
        userId: string;
        isWorkspaceManager: boolean;
        facilitatedRetroIds: string[];
        reviewTeamIds: string[];
    };
};

const Any = 'any';
const ReloadDelayMs = 1_000;
const ReloadProps = ['items', 'focusedItem'];

/** Translation keys, passed to t() through a variable. */
const StatusLabels: Record<StatusFilter, string> = {
    open: 'Open',
    overdue: 'Overdue',
    completed: 'Completed',
    all: 'All',
};

function filterStorageKey(workspaceId: string): string {
    return `skrum.actionItemFilters.${workspaceId}`;
}

function filterQuery(filters: Filters): Record<string, string> {
    const query: Record<string, string> = {};

    if (filters.status !== 'open') {
        query.status = filters.status;
    }

    if (filters.assignee) {
        query.assignee = filters.assignee;
    }

    if (filters.team) {
        query.team = filters.team;
    }

    return query;
}

function readStoredFilters(workspaceId: string): Record<string, string> | null {
    try {
        const stored: unknown = JSON.parse(
            window.localStorage.getItem(filterStorageKey(workspaceId)) ??
                'null',
        );

        if (stored === null || typeof stored !== 'object') {
            return null;
        }

        return Object.fromEntries(
            Object.entries(stored).filter(
                (entry): entry is [string, string] =>
                    typeof entry[1] === 'string',
            ),
        );
    } catch {
        return null;
    }
}

function storeFilters(workspaceId: string, query: Record<string, string>) {
    try {
        window.localStorage.setItem(
            filterStorageKey(workspaceId),
            JSON.stringify(query),
        );
    } catch {
        // Storage can be full or disabled; the filters still apply to this visit.
    }
}

function replaceActionItem(
    items: ActionItem[],
    incoming: ActionItem,
): ActionItem[] {
    return items.map((item) =>
        item.id === incoming.id
            ? {
                  ...incoming,
                  isMine: incoming.isMine || item.isMine,
                  commentsRevision: item.commentsRevision,
              }
            : item,
    );
}

function reload() {
    router.reload({ only: ReloadProps });
}

function useToastRun(): RunMutation {
    const { t } = useTrans();

    return useCallback<RunMutation>(
        async (mutation) => {
            try {
                return await mutation;
            } catch (error) {
                const message =
                    error instanceof RetroRequestError && error.status === 0
                        ? t(
                              'The server did not respond in time. Please try again.',
                          )
                        : error instanceof RetroRequestError &&
                            error.message !== ''
                          ? error.message
                          : t('Something went wrong. Please try again.');

                toast.error(message);
                reload();

                return undefined;
            }
        },
        [t],
    );
}

function RowMeta({
    item,
    teamName,
}: {
    item: ActionItem;
    teamName: string | undefined;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    return (
        <>
            {teamName && (
                <Badge variant="secondary" className="font-normal">
                    {teamName}
                </Badge>
            )}
            {item.source ? (
                <Link
                    href={item.source.retroUrl}
                    className="underline-offset-4 hover:underline"
                >
                    {item.source.retroTitle}
                    {item.source.retroCreatedAt &&
                        ` · ${formatShortDate(item.source.retroCreatedAt, locale)}`}
                </Link>
            ) : (
                <span>{t('Added outside a retro')}</span>
            )}
            {item.assignee && <span>{assigneeLabel(item.assignee, t)}</span>}
        </>
    );
}

function NewActionItemDialog({
    open,
    onOpenChange,
    workspaceSlug,
    teams,
    defaultTeamId,
    run,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceSlug: string;
    teams: TeamOption[];
    defaultTeamId: string | null;
    run: RunMutation;
    onCreated: () => void;
}) {
    const { t } = useTrans();
    const [teamId, setTeamId] = useState(
        teams.some((team) => team.id === defaultTeamId)
            ? (defaultTeamId as string)
            : (teams[0]?.id ?? ''),
    );
    const team = teams.find((option) => option.id === teamId);

    const create = async (
        payload: Record<string, unknown>,
    ): Promise<boolean> => {
        const response = await run(
            retroRequest<{ actionItem: ActionItem }>(
                WorkspaceActionItemsController.store(workspaceSlug),
                { ...payload, team_id: teamId },
            ),
        );

        if (!response) {
            return false;
        }

        onCreated();
        onOpenChange(false);

        return true;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle>{t('New action item')}</DialogTitle>
                <DialogDescription>
                    {t('Add a follow-up to one of your teams.')}
                </DialogDescription>
                <Select value={teamId} onValueChange={setTeamId}>
                    <SelectTrigger className="w-full" aria-label={t('Team')}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {teams.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                                {option.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <ActionItemForm
                    key={teamId}
                    assigneeGroups={teamAssigneeGroups(team?.members ?? [], t)}
                    submitLabel={t('Create')}
                    onSubmit={create}
                />
            </DialogContent>
        </Dialog>
    );
}

export default function ActionItemsIndex({
    workspace,
    filters,
    items,
    focusedItem,
    teams,
    creatableTeams,
    assignees,
    realtimeTeamIds,
    viewer,
}: Props) {
    const { t } = useTrans();
    const run = useToastRun();
    const [rows, setRows] = useState(items.data);
    const [knownRows, setKnownRows] = useState(items.data);
    const [focused, setFocused] = useState(focusedItem);
    const [knownFocused, setKnownFocused] = useState(focusedItem);
    const [creating, setCreating] = useState(false);
    const pendingReload = useRef<ReturnType<typeof setTimeout> | null>(null);
    const endpoints = useMemo(
        () => workspaceActionItemEndpoints(workspace.slug),
        [workspace.slug],
    );
    const teamsById = useMemo(
        () => new Map(teams.map((team) => [team.id, team])),
        [teams],
    );
    const actionViewer: ActionItemViewer = {
        userId: viewer.userId,
        participantId: null,
        isWorkspaceManager: viewer.isWorkspaceManager,
        facilitatedRetroIds: viewer.facilitatedRetroIds,
        reviewTeamIds: viewer.reviewTeamIds,
    };

    if (knownRows !== items.data) {
        setKnownRows(items.data);
        setRows(items.data);
    }

    if (knownFocused !== focusedItem) {
        setKnownFocused(focusedItem);
        setFocused(focusedItem);
    }

    const scheduleReload = useCallback(() => {
        if (pendingReload.current !== null) {
            return;
        }

        pendingReload.current = setTimeout(() => {
            pendingReload.current = null;
            reload();
        }, ReloadDelayMs);
    }, []);

    const replaceRow = useCallback((incoming: ActionItem) => {
        setRows((current) => replaceActionItem(current, incoming));
        setFocused((current) =>
            current === null ? null : replaceActionItem([current], incoming)[0],
        );
    }, []);

    const countComments = useCallback(
        (actionItemId: string, commentCount: number, refresh: boolean) => {
            setRows((current) =>
                countActionItemComments(
                    current,
                    actionItemId,
                    commentCount,
                    refresh,
                ),
            );
            setFocused((current) =>
                current === null
                    ? null
                    : countActionItemComments(
                          [current],
                          actionItemId,
                          commentCount,
                          refresh,
                      )[0],
            );
        },
        [],
    );

    const handlers = useRef({ replaceRow, countComments, scheduleReload });

    handlers.current = { replaceRow, countComments, scheduleReload };

    const channelKey = realtimeTeamIds.join(',');

    useEffect(() => {
        if (!echoIsConfigured() || channelKey === '') {
            return;
        }

        const names = channelKey
            .split(',')
            .map((teamId) => `team-action-items.${teamId}`);

        for (const name of names) {
            echo<'reverb'>()
                .private(name)
                .listen(
                    '.team-action-item.saved',
                    (payload: { actionItem: ActionItem }) => {
                        handlers.current.replaceRow(payload.actionItem);
                        handlers.current.scheduleReload();
                    },
                )
                .listen('.team-action-item.deleted', () =>
                    handlers.current.scheduleReload(),
                )
                .listen(
                    '.team-action-item.comments.changed',
                    (payload: { actionItemId: string; commentCount: number }) =>
                        handlers.current.countComments(
                            payload.actionItemId,
                            payload.commentCount,
                            true,
                        ),
                );
        }

        return () => {
            for (const name of names) {
                echo().leave(name);
            }
        };
    }, [channelKey]);

    useEffect(() => {
        window.addEventListener('focus', reload);

        return () => {
            window.removeEventListener('focus', reload);

            if (pendingReload.current !== null) {
                clearTimeout(pendingReload.current);
            }
        };
    }, []);

    useEffect(() => {
        if (window.location.search !== '') {
            return;
        }

        const stored = readStoredFilters(workspace.id);

        if (stored === null || Object.keys(stored).length === 0) {
            return;
        }

        router.get(
            WorkspaceActionItemsController.index.url(workspace.slug, {
                query: stored,
            }),
            {},
            { preserveState: true, replace: true },
        );
    }, [workspace.id, workspace.slug]);

    useEffect(() => {
        if (filters.item === null) {
            return;
        }

        document
            .getElementById(`action-item-${filters.item}`)
            ?.scrollIntoView({ block: 'center' });
    }, [filters.item]);

    const applyFilters = (changes: Partial<Filters>) => {
        const query = filterQuery({ ...filters, ...changes, item: null });

        storeFilters(workspace.id, query);
        router.get(
            WorkspaceActionItemsController.index.url(workspace.slug, { query }),
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    const renderCard = (item: ActionItem) => (
        <ActionItemCard
            key={item.id}
            item={item}
            endpoints={endpoints}
            viewer={actionViewer}
            assigneeGroups={teamAssigneeGroups(
                teamsById.get(item.teamId)?.members ?? [],
                t,
            )}
            run={run}
            editable
            defaultExpanded={item.id === filters.item}
            meta={
                <RowMeta
                    item={item}
                    teamName={teamsById.get(item.teamId)?.name}
                />
            }
            onSaved={(actionItem) => {
                replaceRow(actionItem);
                scheduleReload();
            }}
            onRemoved={(actionItemId) => {
                setRows((current) =>
                    current.filter((row) => row.id !== actionItemId),
                );
                setFocused((current) =>
                    current?.id === actionItemId ? null : current,
                );
                scheduleReload();
            }}
            onCommentCount={(actionItemId, commentCount) =>
                countComments(actionItemId, commentCount, false)
            }
        />
    );

    const isDefaultFilter =
        filters.status === 'open' &&
        filters.assignee === null &&
        filters.team === null;
    const focusedOutsideList =
        focused !== null && !rows.some((row) => row.id === focused.id);

    return (
        <>
            <Head title={t('Action items')} />
            <div className="max-w-4xl space-y-6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title={t('Action items')}
                        description={t('Follow-ups of every team you can see')}
                    />
                    {creatableTeams.length > 0 && (
                        <Button onClick={() => setCreating(true)}>
                            <Plus />
                            {t('New action item')}
                        </Button>
                    )}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                    <Select
                        value={filters.status}
                        onValueChange={(status) =>
                            applyFilters({ status: status as StatusFilter })
                        }
                    >
                        <SelectTrigger
                            className="w-full"
                            aria-label={t('Status')}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(Object.keys(StatusLabels) as StatusFilter[]).map(
                                (status) => (
                                    <SelectItem key={status} value={status}>
                                        {t(StatusLabels[status])}
                                    </SelectItem>
                                ),
                            )}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.assignee ?? Any}
                        onValueChange={(assignee) =>
                            applyFilters({
                                assignee: assignee === Any ? null : assignee,
                            })
                        }
                    >
                        <SelectTrigger
                            className="w-full"
                            aria-label={t('Assignee')}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={Any}>{t('Anyone')}</SelectItem>
                            <SelectItem value="me">{t('Me')}</SelectItem>
                            <SelectItem value="unassigned">
                                {t('Unassigned')}
                            </SelectItem>
                            {assignees.map((assignee) => (
                                <SelectItem
                                    key={assignee.id}
                                    value={assignee.id}
                                >
                                    {assignee.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.team ?? Any}
                        onValueChange={(team) =>
                            applyFilters({ team: team === Any ? null : team })
                        }
                    >
                        <SelectTrigger
                            className="w-full"
                            aria-label={t('Team')}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={Any}>
                                {t('All teams')}
                            </SelectItem>
                            {teams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {focusedOutsideList && focused && (
                    <section className="space-y-2">
                        <Heading
                            variant="small"
                            title={t('Linked action item')}
                        />
                        <ul>{renderCard(focused)}</ul>
                    </section>
                )}

                {rows.length === 0 ? (
                    <p className="text-muted-foreground">
                        {isDefaultFilter
                            ? t('No open action items.')
                            : t('Nothing matches these filters.')}
                    </p>
                ) : (
                    <ul className="space-y-2">{rows.map(renderCard)}</ul>
                )}

                {items.lastPage > 1 && (
                    <nav
                        className="flex items-center justify-between gap-2 text-sm"
                        aria-label={t('Pagination')}
                    >
                        {items.prevPageUrl ? (
                            <Link href={items.prevPageUrl} preserveScroll>
                                {t('Previous')}
                            </Link>
                        ) : (
                            <span />
                        )}
                        <span className="text-muted-foreground">
                            {t('Page :page of :total', {
                                page: items.currentPage,
                                total: items.lastPage,
                            })}
                        </span>
                        {items.nextPageUrl ? (
                            <Link href={items.nextPageUrl} preserveScroll>
                                {t('Next')}
                            </Link>
                        ) : (
                            <span />
                        )}
                    </nav>
                )}
            </div>

            {creating && (
                <NewActionItemDialog
                    open={creating}
                    onOpenChange={setCreating}
                    workspaceSlug={workspace.slug}
                    teams={creatableTeams}
                    defaultTeamId={filters.team}
                    run={run}
                    onCreated={reload}
                />
            )}
        </>
    );
}
