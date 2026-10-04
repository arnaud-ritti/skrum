import {
    Calendar as CalendarIcon,
    CalendarX,
    CircleDot,
    SignalHigh,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { ActionItemTeam } from '@/components/action-items/action-item-create-dialog';
import { BulkAssignMenu } from '@/components/action-items/bulk-assign-menu';
import type { BulkAssignee } from '@/components/action-items/bulk-assign-menu';
import { BulkDeleteConfirm } from '@/components/action-items/bulk-delete-confirm';
import { BulkMatchingConfirm } from '@/components/action-items/bulk-matching-confirm';
import { useBulkResultToast } from '@/components/action-items/bulk-result-toast';
import type { ActionItemFilters } from '@/components/action-items/use-action-item-filters';
import type { RunMutation } from '@/components/action-items/use-action-item-mutations';
import type { ActionItemSelection } from '@/components/action-items/use-action-item-selection';
import {
    ActionPriorityMark,
    useActionItemLabels,
} from '@/components/skrum/action-item';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { bulkDelete, bulkUpdate } from '@/lib/action-items/bulk';
import type { BulkChanges, BulkTarget } from '@/lib/action-items/bulk';
import { localToday } from '@/lib/action-items/due';
import {
    canCompleteActionItem,
    canManageActionItem,
} from '@/lib/action-items/permissions';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import { MatchingCap } from '@/lib/action-items/selection';
import { RetroRequestError } from '@/lib/retro/api';
import type {
    ActionItem,
    ActionItemPriority,
    ActionItemStatus,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';

type BulkAction = 'status' | 'assign' | 'due' | 'priority' | 'delete';

type Props = {
    /** The workspace's slug. */
    workspace: string;
    locale: string;
    /** The rows of the page. */
    items: ActionItem[];
    selection: ActionItemSelection;
    filters: ActionItemFilters;
    /** The teams of the page's filter, with their members. */
    teams: ActionItemTeam[];
    viewer: ActionItemViewer;
    /** The page's toast-and-resync wrapper of a request. */
    run: RunMutation;
    onSaved: (item: ActionItem) => void;
    onRemoved: (actionItemId: string) => void;
    /** Reloads the list and its counters. */
    onReload: () => void;
    layout?: 'floating' | 'docked';
};

const Statuses: ActionItemStatus[] = ['open', 'doing', 'completed'];

const Priorities: ActionItemPriority[] = ['high', 'medium', 'low'];

/** The server's sentence when the matching list changed since it was counted. */
function listChangedSentence(error: unknown): string | null {
    if (!(error instanceof RetroRequestError) || error.status !== 422) {
        return null;
    }

    return error.errors.count?.[0] ?? null;
}

/** The members of every given team, in the order of the first one. */
function commonMembers(
    teams: ActionItemTeam[],
    teamIds: string[],
): BulkAssignee[] {
    const chosen = teamIds
        .map((teamId) => teams.find((team) => team.id === teamId))
        .filter((team) => team !== undefined);

    if (chosen.length === 0) {
        return [];
    }

    const [first, ...others] = chosen;

    return first.members.filter((member) =>
        others.every((team) =>
            team.members.some((other) => other.id === member.id),
        ),
    );
}

/** The count, its number in bold as the mockup draws it. */
function CountSentence({
    sentence,
    count,
}: {
    sentence: string;
    count: number;
}) {
    const number = String(count);
    const at = sentence.indexOf(number);

    if (at === -1) {
        return sentence;
    }

    return (
        <>
            {sentence.slice(0, at)}
            <b className="inline-grid h-5.5 min-w-5.5 place-items-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {number}
            </b>
            {sentence.slice(at + number.length)}
        </>
    );
}

/**
 * A bar button; disabled, it explains why in a tooltip, which a disabled
 * button cannot open on its own.
 */
function BarButton({
    icon: Icon,
    label,
    busy,
    disabledReason,
    className,
    ...props
}: ComponentProps<typeof Button> & {
    icon: LucideIcon;
    label: string;
    busy: boolean;
    disabledReason?: string;
}) {
    const button = (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className={className}
            {...props}
            disabled={props.disabled || disabledReason !== undefined}
        >
            {busy ? <Spinner aria-hidden /> : <Icon aria-hidden />}
            {label}
        </Button>
    );

    if (disabledReason === undefined) {
        return button;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    tabIndex={0}
                    className="inline-flex rounded-md outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    {button}
                </span>
            </TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
        </Tooltip>
    );
}

/**
 * The bar of the selected rows (spec 24 §9.4, ScreenActions `.ac-bulk`): the
 * count, "Select all :count matching", Status, Assign, Due date, Priority,
 * Delete and "Clear selection". Every item is checked by the server on its
 * own; the bar reports what was refused.
 */
export function ActionItemsBulkBar({
    workspace,
    locale,
    items,
    selection,
    filters,
    teams,
    viewer,
    run,
    onSaved,
    onRemoved,
    onReload,
    layout = 'floating',
}: Props) {
    const { t } = useTrans();
    const labels = useActionItemLabels();
    const result = useBulkResultToast();
    const [pending, setPending] = useState<BulkAction | null>(null);
    const [asking, setAsking] = useState<{
        action: BulkAction;
        changes: BulkChanges;
    } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [changedSentence, setChangedSentence] = useState<string>();
    const [dueOpen, setDueOpen] = useState(false);

    const matching = selection.matching;
    const selectedRows = items.filter((item) => selection.isSelected(item.id));
    const mayComplete = selectedRows.some((item) =>
        canCompleteActionItem(item, viewer),
    );
    const mayManage = selectedRows.some((item) =>
        canManageActionItem(item, viewer),
    );
    const cannot = t('None of the selected action items lets you do this.');
    const busy = pending !== null;

    const selectionTeamIds =
        matching === null
            ? [...new Set(selectedRows.map((item) => item.teamId))]
            : filters.team !== null
              ? [filters.team]
              : teams.map((team) => team.id);
    const members = commonMembers(teams, selectionTeamIds);

    /**
     * Sends a request; a list that changed since it was counted keeps the
     * confirmation open with the server's sentence and reloads the count.
     */
    const request = async <T,>(
        target: BulkTarget,
        call: () => Promise<T>,
    ): Promise<T | undefined> => {
        try {
            return await call();
        } catch (error) {
            const changed = listChangedSentence(error);

            if (changed !== null && 'filters' in target) {
                setChangedSentence(changed);
                onReload();

                throw error;
            }

            return run(Promise.reject(error));
        }
    };

    const settle = (target: BulkTarget, refusedIds: string[]): void => {
        if (!('ids' in target) || refusedIds.length === 0) {
            selection.clear();

            if ('filters' in target) {
                onReload();
            }

            return;
        }

        selection.setMany(
            target.ids.filter((id) => !refusedIds.includes(id)),
            false,
        );
    };

    const update = async (
        action: BulkAction,
        changes: BulkChanges,
    ): Promise<void> => {
        const target = selection.target(filters);

        setPending(action);

        try {
            const response = await request(target, () =>
                bulkUpdate(workspace, target, changes),
            );

            if (response === undefined) {
                return;
            }

            response.actionItems.forEach((item) => onSaved(item));
            result.report('update', response.changedCount, response.refused);
            settle(
                target,
                response.refused.map((refusal) => refusal.id),
            );
        } finally {
            setPending(null);
        }
    };

    const remove = async (): Promise<void> => {
        const target = selection.target(filters);

        setPending('delete');

        try {
            const response = await request(target, () =>
                bulkDelete(workspace, target),
            );

            if (response === undefined) {
                return;
            }

            response.deleted.forEach((actionItemId) => onRemoved(actionItemId));
            result.report('delete', response.deleted.length, response.refused);
            settle(
                target,
                response.refused.map((refusal) => refusal.id),
            );
        } finally {
            setPending(null);
        }
    };

    const change = (action: BulkAction, changes: BulkChanges): void => {
        if (matching !== null) {
            setChangedSentence(undefined);
            setAsking({ action, changes });

            return;
        }

        void update(action, changes);
    };

    const closeDialogs = (): void => {
        setAsking(null);
        setDeleting(false);
        setChangedSentence(undefined);
    };

    const statusButton = (
        <BarButton
            icon={CircleDot}
            label={t('Status')}
            busy={pending === 'status'}
            disabled={busy}
            disabledReason={mayComplete ? undefined : cannot}
        />
    );
    const manageReason = mayManage ? undefined : cannot;
    const assignButton = (
        <BarButton
            icon={UserRound}
            label={t('Assign')}
            busy={pending === 'assign'}
            disabled={busy}
            disabledReason={manageReason}
        />
    );
    const dueButton = (
        <BarButton
            icon={CalendarIcon}
            label={t('Due date')}
            busy={pending === 'due'}
            disabled={busy}
            disabledReason={manageReason}
        />
    );
    const priorityButton = (
        <BarButton
            icon={SignalHigh}
            label={t('Priority')}
            busy={pending === 'priority'}
            disabled={busy}
            disabledReason={manageReason}
        />
    );

    const menu = (trigger: ReactNode, enabled: boolean, content: ReactNode) =>
        enabled ? (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                    {content}
                </DropdownMenuContent>
            </DropdownMenu>
        ) : (
            trigger
        );

    const offer = selection.offer;
    const tooMany = offer === 'too-many';
    const offerButton = offer !== null && (
        <Button
            type="button"
            variant="link"
            size="sm"
            data-slot="bulk-select-matching"
            aria-disabled={tooMany || busy ? true : undefined}
            className="px-1 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={() => {
                if (tooMany || busy) {
                    return;
                }

                selection.selectMatching();
            }}
        >
            {t('Select all :count matching', { count: selection.total })}
        </Button>
    );

    return (
        <>
            {selection.count > 0 && (
                <div
                    role="toolbar"
                    aria-label={t('Bulk actions')}
                    data-slot="action-items-bulk-bar"
                    data-layout={layout}
                    className={cn(
                        'z-(--z-chrome) flex items-center gap-2 border bg-popover text-popover-foreground shadow-modal motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2',
                        layout === 'floating'
                            ? 'sticky bottom-6 mx-auto w-fit max-w-full flex-wrap rounded-xl py-1.5 pr-1.5 pl-3.5'
                            : 'sticky bottom-0 w-full rounded-t-xl px-3 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)]',
                    )}
                >
                    <span
                        role="status"
                        aria-live="polite"
                        className="inline-flex items-center gap-2 pr-2 text-sm font-semibold"
                    >
                        {matching === null ? (
                            <CountSentence
                                count={selection.count}
                                sentence={
                                    selection.count === 1
                                        ? t('1 selected')
                                        : t(':count selected', {
                                              count: selection.count,
                                          })
                                }
                            />
                        ) : (
                            <CountSentence
                                count={matching.count}
                                sentence={t('All :count matching selected', {
                                    count: matching.count,
                                })}
                            />
                        )}
                    </span>
                    {offerButton &&
                        (tooMany ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    {offerButton}
                                </TooltipTrigger>
                                <TooltipContent>
                                    {t(
                                        'Up to :cap at once. Narrow the filters.',
                                        {
                                            cap: MatchingCap,
                                        },
                                    )}
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            offerButton
                        ))}
                    <span
                        aria-hidden
                        className="my-1 w-px self-stretch bg-border"
                    />
                    {menu(
                        statusButton,
                        mayComplete && !busy,
                        Statuses.map((status) => (
                            <DropdownMenuItem
                                key={status}
                                onSelect={() => change('status', { status })}
                            >
                                {labels.status[status]}
                            </DropdownMenuItem>
                        )),
                    )}
                    {mayManage && !busy ? (
                        <BulkAssignMenu
                            members={members}
                            trigger={assignButton}
                            onAssign={(userId) =>
                                change('assign', { assignee_user_id: userId })
                            }
                        />
                    ) : (
                        assignButton
                    )}
                    {mayManage && !busy ? (
                        <Popover open={dueOpen} onOpenChange={setDueOpen}>
                            <PopoverTrigger asChild>{dueButton}</PopoverTrigger>
                            <PopoverContent
                                align="start"
                                side="top"
                                className="grid w-auto gap-2 p-2"
                            >
                                <Calendar
                                    mode="single"
                                    locale={locale === 'fr' ? 'fr' : 'en'}
                                    onSelect={(date) => {
                                        if (date === undefined) {
                                            return;
                                        }

                                        setDueOpen(false);
                                        change('due', {
                                            due_on: localToday(date),
                                        });
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start"
                                    onClick={() => {
                                        setDueOpen(false);
                                        change('due', { due_on: null });
                                    }}
                                >
                                    <CalendarX aria-hidden />
                                    {t('No due date')}
                                </Button>
                            </PopoverContent>
                        </Popover>
                    ) : (
                        dueButton
                    )}
                    {menu(
                        priorityButton,
                        mayManage && !busy,
                        Priorities.map((priority) => (
                            <DropdownMenuItem
                                key={priority}
                                onSelect={() =>
                                    change('priority', { priority })
                                }
                            >
                                <ActionPriorityMark
                                    priority={priority}
                                    label={labels.priority[priority]}
                                />
                            </DropdownMenuItem>
                        )),
                    )}
                    <BarButton
                        icon={Trash2}
                        label={t('Delete')}
                        busy={pending === 'delete'}
                        disabled={busy}
                        disabledReason={manageReason}
                        className="text-skrum-destructive-text hover:text-skrum-destructive-text"
                        onClick={() => {
                            setChangedSentence(undefined);
                            setDeleting(true);
                        }}
                    />
                    <span
                        aria-hidden
                        className="my-1 w-px self-stretch bg-border"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('Clear selection')}
                        disabled={busy}
                        onClick={selection.clear}
                    >
                        <X aria-hidden />
                    </Button>
                </div>
            )}

            <BulkMatchingConfirm
                open={asking !== null}
                count={selection.count}
                changedSentence={changedSentence}
                onCancel={closeDialogs}
                onApply={async () => {
                    if (asking !== null) {
                        await update(asking.action, asking.changes);
                    }
                }}
            />
            <BulkDeleteConfirm
                open={deleting}
                count={selection.count}
                changedSentence={changedSentence}
                onCancel={closeDialogs}
                onConfirm={remove}
            />
            {result.details}
        </>
    );
}
