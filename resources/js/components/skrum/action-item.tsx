import { Link } from '@inertiajs/react';
import {
    CalendarClock,
    CalendarIcon,
    CircleCheck,
    ExternalLink as ExternalLinkIcon,
    Link as LinkIcon,
    ListChecks,
    MessageSquare,
    Pencil,
    RefreshCw,
    Repeat,
    StickyNote,
    Trash2,
    TriangleAlert,
    UserPlus,
    Users,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type {
    ComponentProps,
    ComponentPropsWithoutRef,
    FocusEvent,
    KeyboardEvent,
    ReactNode,
} from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DueDatePicker } from '@/components/skrum/due-date-picker';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { localToday } from '@/lib/action-items/due';
import { formatRelativeTime } from '@/lib/action-items/format';
import { TrackerLabels } from '@/lib/poker/types';
import { cn } from '@/lib/utils';
import type { ExternalLink } from '@/types/integrations';

export type ActionItemStatus = 'open' | 'doing' | 'completed';
export type ActionItemPriority = 'low' | 'medium' | 'high';
export type ActionItemRecurrence = 'weekly' | 'every_two_weeks' | 'monthly';

export type ActionItemOwner = {
    id: string;
    name: string;
    kind?: 'member' | 'guest';
    isTeamMember?: boolean;
    presence?: ComponentProps<typeof PersonAvatar>['presence'];
    avatarUrl?: string | null;
    /**
     * Heading the person is listed under in the assignee options, such as
     * "In this retro". Left out, the options are one flat list.
     */
    group?: string;
};

export type ActionItemPerson = { name: string; avatarUrl?: string | null };

/** The back-end `ExternalLink` fits as is; only the first four keys are needed. */
export type ActionItemLink = Pick<
    ExternalLink,
    'id' | 'source' | 'key' | 'url'
> &
    Partial<
        Pick<
            ExternalLink,
            'state' | 'statusName' | 'syncState' | 'syncError' | 'lastSyncedAt'
        >
    >;

export type ActionItemSubtaskSummary = { isCompleted: boolean };

export type ActionItemSourceRef = {
    label: string;
    url?: string;
    retroId?: string;
};

export type ActionItemPatch = {
    title?: string;
    priority?: ActionItemPriority;
    dueDate?: string | null;
    owner?: ActionItemOwner | null;
    recurrence?: ActionItemRecurrence | null;
};

export type ActionItemData = {
    title: string;
    status: ActionItemStatus;
    priority: ActionItemPriority;
    dueDate?: string | null;
    /** The server's `isOverdue`; computed from `today` when left out. */
    overdue?: boolean;
    doneAt?: string | null;
    completedVia?: ExternalLink['source'] | null;
    owner?: ActionItemOwner | null;
    /** `null` is a former member; left out, the creator is not shown. */
    createdBy?: ActionItemPerson | null;
    themeName?: string | null;
    teamName?: string | null;
    source?: ActionItemSourceRef | null;
    /** `null` is "does not repeat"; left out, recurrence is not offered. */
    recurrence?: ActionItemRecurrence | null;
    /** Creation date of an item that follows up a completed occurrence. */
    followUpDate?: string | null;
    subtasks?: ActionItemSubtaskSummary[];
    commentCount?: number;
    links?: ActionItemLink[] | null;
    members?: ActionItemOwner[];
    withDoing?: boolean;
    today?: string;
    locale?: string;
    onStatusChange?: (status: ActionItemStatus) => void;
    onChange?: (patch: ActionItemPatch) => void;
    onDelete?: () => void;
    onRetrySync?: (link: ActionItemLink) => void;
};

export type ActionItemProps = ActionItemData &
    Omit<
        ComponentPropsWithoutRef<'div'>,
        'title' | 'onChange' | 'children' | 'role'
    > & {
        editing?: boolean;
        /** The viewer may complete or reopen (assignee, reviewer, manager). */
        canComplete?: boolean;
        busy?: boolean;
        /** `group` when a list item wraps the row with more, such as a box. */
        role?: 'listitem' | 'group';
        titleMaxLength?: number;
        showOwnerName?: boolean;
        commentsOpen?: boolean;
        /** Extra meta of the page (team link, source retro, assignee label). */
        meta?: ReactNode;
        /** Row actions wired by the page, such as the export menu. */
        actions?: ReactNode;
        /** The comment thread, shown while `commentsOpen`. */
        comments?: ReactNode;
        /** Details under the row, such as the sub-task checklist. */
        children?: ReactNode;
        onEditStart?: () => void;
        onEditCancel?: () => void;
        onLinkTicket?: () => void;
        onToggleComments?: () => void;
    };

export const ActionItemRecurrences: ActionItemRecurrence[] = [
    'weekly',
    'every_two_weeks',
    'monthly',
];

const NoOwner = 'none';
const NoRecurrence = 'none';

const priorityStyles: Record<
    ActionItemPriority,
    { text: string; bars: number }
> = {
    low: { text: 'text-muted-foreground', bars: 1 },
    medium: { text: 'text-skrum-warning-text', bars: 2 },
    high: { text: 'text-skrum-destructive-text', bars: 3 },
};

const barHeights = ['h-1.5', 'h-2.5', 'h-3.5'];

/**
 * A date-only value reads as the calendar day it names; a timestamp reads
 * as the day it fell on for the viewer.
 */
export function formatActionDay(iso: string, locale: string): string {
    if (iso.includes('T')) {
        return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
        }).format(new Date(iso));
    }

    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function defaultActionLocale(): string {
    if (typeof document === 'undefined') {
        return 'en';
    }

    return document.documentElement.lang || 'en';
}

export function nextActionStatus(
    status: ActionItemStatus,
    withDoing: boolean,
): ActionItemStatus {
    if (status === 'completed') {
        return 'open';
    }

    if (status === 'open' && withDoing) {
        return 'doing';
    }

    return 'completed';
}

export function isActionOverdue(
    dueDate: string | null | undefined,
    status: ActionItemStatus,
    today: string,
): boolean {
    if (!dueDate || status === 'completed') {
        return false;
    }

    return dueDate.slice(0, 10) < today;
}

export function actionOwnerValue(
    owner: ActionItemOwner | null | undefined,
): string {
    if (!owner) {
        return NoOwner;
    }

    return `${owner.kind ?? 'member'}:${owner.id}`;
}

export function resolveActionOverdue({
    overdue,
    dueDate,
    status,
    today,
}: Pick<ActionItemData, 'overdue' | 'dueDate' | 'status' | 'today'>): boolean {
    if (status === 'completed') {
        return false;
    }

    return overdue ?? isActionOverdue(dueDate, status, today ?? localToday());
}

export function useActionItemLabels() {
    const { t } = useTrans();

    const status: Record<ActionItemStatus, string> = {
        open: t('To do'),
        doing: t('In progress'),
        completed: t('Done status'),
    };
    const priority: Record<ActionItemPriority, string> = {
        low: t('Low'),
        medium: t('Medium'),
        high: t('High'),
    };
    const recurrence: Record<ActionItemRecurrence, string> = {
        weekly: t('Weekly'),
        every_two_weeks: t('Every 2 weeks'),
        monthly: t('Monthly'),
    };
    const repeats: Record<ActionItemRecurrence, string> = {
        weekly: t('Repeats weekly'),
        every_two_weeks: t('Repeats every 2 weeks'),
        monthly: t('Repeats monthly'),
    };
    const statusAction: Record<ActionItemStatus, string> = {
        open: t('Reopen'),
        doing: t('Mark as in progress'),
        completed: t('Mark as done'),
    };
    const ownerName = (owner: ActionItemOwner): string => {
        if (owner.kind === 'guest') {
            return `${owner.name} (${t('Guest')})`;
        }

        if (owner.isTeamMember === false) {
            return t(':name (not in team)', { name: owner.name });
        }

        return owner.name;
    };

    return { status, priority, recurrence, repeats, statusAction, ownerName };
}

/** The people of an assignee select, under the heading of their group when they have one. */
export function groupActionOwners(
    members: ActionItemOwner[],
): { label: string | null; members: ActionItemOwner[] }[] {
    const groups: { label: string | null; members: ActionItemOwner[] }[] = [];

    for (const member of members) {
        const label = member.group ?? null;
        const group = groups.find((candidate) => candidate.label === label);

        if (group) {
            group.members.push(member);

            continue;
        }

        groups.push({ label, members: [member] });
    }

    return groups;
}

/** The options of an assignee select, inside its `SelectContent`. */
export function ActionOwnerOptions({
    members,
    withAvatar = false,
}: {
    members: ActionItemOwner[];
    withAvatar?: boolean;
}) {
    const labels = useActionItemLabels();

    const option = (member: ActionItemOwner) => (
        <SelectItem
            key={actionOwnerValue(member)}
            value={actionOwnerValue(member)}
        >
            {withAvatar && (
                <PersonAvatar
                    decorative
                    size="xs"
                    name={member.name}
                    kind={member.kind}
                    src={member.avatarUrl}
                />
            )}
            {labels.ownerName(member)}
        </SelectItem>
    );

    return groupActionOwners(members).map((group) =>
        group.label === null ? (
            group.members.map(option)
        ) : (
            <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.members.map(option)}
            </SelectGroup>
        ),
    );
}

export function ActionPriorityMark({
    priority,
    label,
}: {
    priority: ActionItemPriority;
    label: string;
}) {
    const style = priorityStyles[priority];

    return (
        <span
            data-slot="action-item-priority"
            data-priority={priority}
            className={cn(
                'inline-flex items-center gap-1 text-xs font-bold',
                style.text,
            )}
        >
            <span aria-hidden className="inline-flex h-3.5 items-end gap-0.5">
                {barHeights.map((height, index) => (
                    <i
                        key={height}
                        className={cn(
                            'block w-0.75 rounded-full bg-current',
                            height,
                            index >= style.bars && 'opacity-25',
                        )}
                    />
                ))}
            </span>
            {label}
        </span>
    );
}

export function ActionStatusBadge({
    status,
    overdue,
}: {
    status: ActionItemStatus;
    overdue: boolean;
}) {
    const { t } = useTrans();
    const labels = useActionItemLabels();

    if (overdue) {
        return (
            <Badge variant="destructive" shape="pill">
                {t('Overdue')}
            </Badge>
        );
    }

    const variants = {
        open: 'outline',
        doing: 'info',
        completed: 'success',
    } as const;

    return (
        <Badge shape="pill" variant={variants[status]}>
            {labels.status[status]}
        </Badge>
    );
}

function StatusIcon({ status }: { status: ActionItemStatus }) {
    if (status === 'completed') {
        return (
            <svg viewBox="0 0 20 20" aria-hidden className="size-5">
                <circle cx="10" cy="10" r="9" className="fill-skrum-success" />
                <path
                    d="M6 10.4 8.7 13 14 7.4"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="stroke-skrum-success-foreground"
                />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 20 20" aria-hidden className="size-5">
            <circle
                cx="10"
                cy="10"
                r="8.5"
                fill="none"
                strokeWidth="1.5"
                className="stroke-input"
            />
            {status === 'doing' && (
                <path
                    d="M10 4.5a5.5 5.5 0 0 1 0 11z"
                    className="fill-skrum-info-text"
                />
            )}
        </svg>
    );
}

export function useActionLinkSummary(link: ActionItemLink) {
    const { t } = useTrans();
    const provider = TrackerLabels[link.source];
    const syncState = link.syncState ?? 'off';
    const stateLabel = link.state === 'done' ? t('Done') : t('Not done');
    const trackerStatus = link.statusName ?? stateLabel;
    const summaries: Record<typeof syncState, string | null> = {
        off: null,
        synced: t(':status in :source', {
            status: trackerStatus,
            source: provider,
        }),
        pending: t('Sync pending'),
        failed: link.syncError
            ? t('Sync failed: :error', { error: link.syncError })
            : t('Sync failed'),
        missing: t('Not found in :source', { source: provider }),
    };

    return {
        provider,
        syncState,
        trackerStatus,
        summary: summaries[syncState],
        needsAttention: syncState === 'failed' || syncState === 'missing',
    };
}

export function ActionItemLinkChip({
    link,
    locale,
    disabled = false,
    onRetrySync,
}: {
    link: ActionItemLink;
    locale: string;
    disabled?: boolean;
    onRetrySync?: (link: ActionItemLink) => void;
}) {
    const { t } = useTrans();
    const [openedAt, setOpenedAt] = useState(0);
    const { provider, syncState, trackerStatus, summary, needsAttention } =
        useActionLinkSummary(link);
    const detail =
        syncState === 'synced' && link.lastSyncedAt && openedAt > 0
            ? t(':status in :source · synced :time', {
                  status: trackerStatus,
                  source: provider,
                  time: formatRelativeTime(link.lastSyncedAt, locale, openedAt),
              })
            : summary;
    const openLabel = t('Open :key in :provider', {
        key: link.key,
        provider,
    });

    const chip = (
        <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            data-slot="action-item-link"
            data-sync-state={syncState}
            aria-label={summary ? `${openLabel} · ${summary}` : openLabel}
            className="inline-flex max-w-56 min-w-0 items-center gap-1 rounded-xs border bg-muted px-1.5 font-mono text-xs leading-5 font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
            {needsAttention && (
                <TriangleAlert
                    aria-hidden
                    className="size-3.5 shrink-0 text-skrum-warning-text"
                />
            )}
            {!needsAttention && syncState !== 'off' && link.state && (
                <span
                    aria-hidden
                    className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        link.state === 'done'
                            ? 'bg-skrum-success'
                            : 'border border-muted-foreground',
                    )}
                />
            )}
            <ExternalLinkIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">
                {provider} · {link.key}
            </span>
            {summary && <span className="sr-only">{summary}</span>}
        </a>
    );

    return (
        <span className="inline-flex max-w-full min-w-0 items-center gap-0.5">
            {summary === null ? (
                chip
            ) : (
                <Tooltip
                    onOpenChange={(open) => {
                        if (open) {
                            setOpenedAt(Date.now());
                        }
                    }}
                >
                    <TooltipTrigger asChild>{chip}</TooltipTrigger>
                    <TooltipContent>{detail}</TooltipContent>
                </Tooltip>
            )}
            {syncState === 'failed' && onRetrySync && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="size-6 shrink-0"
                            disabled={disabled}
                            aria-label={t('Retry the sync of :key', {
                                key: link.key,
                            })}
                            onClick={() => onRetrySync(link)}
                        >
                            <RefreshCw aria-hidden className="size-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {t('Retry the sync of :key', { key: link.key })}
                    </TooltipContent>
                </Tooltip>
            )}
        </span>
    );
}

export function ActionItem({
    title,
    status,
    priority,
    dueDate = null,
    overdue: overdueProp,
    doneAt = null,
    completedVia = null,
    owner = null,
    createdBy,
    themeName = null,
    teamName = null,
    source = null,
    recurrence,
    followUpDate = null,
    subtasks,
    commentCount,
    links = null,
    members,
    withDoing = false,
    today,
    locale = defaultActionLocale(),
    editing = false,
    canComplete = true,
    busy = false,
    titleMaxLength = 500,
    showOwnerName = false,
    commentsOpen = false,
    meta,
    actions,
    comments,
    children,
    onStatusChange,
    onChange,
    onDelete,
    onRetrySync,
    onEditStart,
    onEditCancel,
    onLinkTicket,
    onToggleComments,
    className,
    id,
    ...rest
}: ActionItemProps) {
    const { t } = useTrans();
    const labels = useActionItemLabels();
    const generatedId = useId();
    const titleId = `${generatedId}-title`;
    const commentsId = `${id ?? generatedId}-comments`;
    const rowRef = useRef<HTMLDivElement>(null);
    const editButtonRef = useRef<HTMLButtonElement>(null);
    const editorHeldFocus = useRef(false);
    const [draftTitle, setDraftTitle] = useState(title);
    const [draftPriority, setDraftPriority] = useState(priority);
    const [draftDue, setDraftDue] = useState(dueDate?.slice(0, 10) ?? '');
    const [draftOwner, setDraftOwner] = useState(actionOwnerValue(owner));
    const [draftRecurrence, setDraftRecurrence] = useState<string>(
        recurrence ?? NoRecurrence,
    );
    const [wasEditing, setWasEditing] = useState(editing);

    if (editing !== wasEditing) {
        setWasEditing(editing);

        if (editing) {
            setDraftTitle(title);
            setDraftPriority(priority);
            setDraftDue(dueDate?.slice(0, 10) ?? '');
            setDraftOwner(actionOwnerValue(owner));
            setDraftRecurrence(recurrence ?? NoRecurrence);
        }
    }

    useEffect(() => {
        if (editing || !editorHeldFocus.current) {
            return;
        }

        editorHeldFocus.current = false;

        const focused = document.activeElement;

        if (
            focused &&
            focused !== document.body &&
            !rowRef.current?.contains(focused)
        ) {
            return;
        }

        (editButtonRef.current ?? rowRef.current)?.focus();
    }, [editing]);

    const isCompleted = status === 'completed';
    const overdue = resolveActionOverdue({
        overdue: overdueProp,
        dueDate,
        status,
        today,
    });
    const nextStatus = nextActionStatus(status, withDoing);
    const completes = Boolean(onStatusChange) && canComplete && !busy;
    const statusButtonLabel = labels.statusAction[nextStatus];
    const doneSubtasks =
        subtasks?.filter((subtask) => subtask.isCompleted).length ?? 0;
    const ownerIsListed =
        !owner ||
        (members ?? []).some(
            (member) => actionOwnerValue(member) === actionOwnerValue(owner),
        );
    const hasDetails =
        Boolean(children) ||
        (commentCount !== undefined && Boolean(onToggleComments)) ||
        (commentsOpen && Boolean(comments));
    const commentsLabel =
        commentCount === 1
            ? t('1 comment')
            : t(':count comments', { count: commentCount ?? 0 });

    const save = (): void => {
        const trimmed = draftTitle.trim();

        if (trimmed === '' || busy) {
            return;
        }

        const patch: ActionItemPatch = {
            title: trimmed,
            priority: draftPriority,
            dueDate: draftDue === '' ? null : draftDue,
        };

        if (members && draftOwner !== actionOwnerValue(owner)) {
            patch.owner =
                members.find(
                    (member) => actionOwnerValue(member) === draftOwner,
                ) ?? null;
        }

        if (recurrence !== undefined) {
            patch.recurrence =
                draftDue === '' || draftRecurrence === NoRecurrence
                    ? null
                    : (draftRecurrence as ActionItemRecurrence);
        }

        editorHeldFocus.current = true;
        onChange?.(patch);
    };

    const cancel = (): void => {
        editorHeldFocus.current = true;
        onEditCancel?.();
    };

    const handleEditorKeyDown = (
        event: KeyboardEvent<HTMLDivElement>,
    ): void => {
        if (!event.currentTarget.contains(event.target as Node)) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            cancel();

            return;
        }

        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            save();
        }
    };

    const handleEditorBlur = (event: FocusEvent<HTMLDivElement>): void => {
        if (
            event.relatedTarget &&
            !event.currentTarget.contains(event.relatedTarget)
        ) {
            editorHeldFocus.current = false;
        }
    };

    const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.target !== event.currentTarget) {
            return;
        }

        if (event.key === 'Enter' && onEditStart && !busy) {
            event.preventDefault();
            onEditStart();

            return;
        }

        if (event.key === ' ' && completes) {
            event.preventDefault();
            onStatusChange?.(nextStatus);
        }
    };

    const sourceLabel = source && (
        <>
            <StickyNote aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{source.label}</span>
        </>
    );

    return (
        <div
            {...rest}
            ref={rowRef}
            id={id}
            role={rest.role ?? 'listitem'}
            data-slot="action-item"
            data-status={status}
            data-overdue={overdue ? 'true' : undefined}
            data-editing={editing ? 'true' : undefined}
            aria-labelledby={editing ? undefined : titleId}
            aria-label={editing ? title : undefined}
            aria-busy={busy ? true : undefined}
            tabIndex={editing ? undefined : 0}
            onKeyDown={(event) => {
                rest.onKeyDown?.(event);

                if (!editing) {
                    handleRowKeyDown(event);
                }
            }}
            className={cn(
                '@container/action rounded-lg border bg-card outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                overdue && 'border-skrum-destructive-text',
                className,
            )}
        >
            <div className="flex flex-wrap items-start gap-3 px-3.5 py-3">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            data-slot="action-item-status"
                            aria-label={statusButtonLabel}
                            disabled={!completes}
                            onClick={() => onStatusChange?.(nextStatus)}
                            className={cn(
                                'inline-flex size-5 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed',
                                editing && 'mt-2',
                            )}
                        >
                            <StatusIcon status={status} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent shortcut={[t('Space')]}>
                        {statusButtonLabel}
                    </TooltipContent>
                </Tooltip>
                <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
                    {editing ? (
                        <div
                            data-slot="action-item-editor"
                            className="flex flex-col gap-2"
                            onKeyDown={handleEditorKeyDown}
                            onFocus={() => {
                                editorHeldFocus.current = true;
                            }}
                            onBlur={handleEditorBlur}
                        >
                            <Input
                                autoFocus
                                aria-label={t('Action title')}
                                value={draftTitle}
                                maxLength={titleMaxLength}
                                onChange={(event) =>
                                    setDraftTitle(event.target.value)
                                }
                            />
                            <div className="flex flex-wrap items-center gap-2">
                                <Select
                                    value={draftPriority}
                                    onValueChange={(value) =>
                                        setDraftPriority(
                                            value as ActionItemPriority,
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        size="sm"
                                        className="max-w-full min-w-0"
                                        aria-label={t('Priority')}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(
                                            [
                                                'high',
                                                'medium',
                                                'low',
                                            ] as ActionItemPriority[]
                                        ).map((value) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                            >
                                                {labels.priority[value]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <DueDatePicker
                                    value={draftDue}
                                    onValueChange={setDraftDue}
                                    locale={locale}
                                    className="w-auto max-w-full **:data-[slot=date-picker-trigger]:h-8"
                                />
                                {recurrence !== undefined && (
                                    <Select
                                        value={
                                            draftDue === ''
                                                ? NoRecurrence
                                                : draftRecurrence
                                        }
                                        disabled={draftDue === ''}
                                        onValueChange={setDraftRecurrence}
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="max-w-full min-w-0"
                                            aria-label={t('Repeat')}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NoRecurrence}>
                                                {t('Does not repeat')}
                                            </SelectItem>
                                            {ActionItemRecurrences.map(
                                                (value) => (
                                                    <SelectItem
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {
                                                            labels.recurrence[
                                                                value
                                                            ]
                                                        }
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                                {members && (
                                    <Select
                                        value={draftOwner}
                                        onValueChange={setDraftOwner}
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="max-w-full min-w-0"
                                            aria-label={t('Assignee')}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NoOwner}>
                                                {t('Unassigned')}
                                            </SelectItem>
                                            {owner && !ownerIsListed && (
                                                <SelectItem
                                                    value={actionOwnerValue(
                                                        owner,
                                                    )}
                                                    disabled
                                                >
                                                    {labels.ownerName(owner)}
                                                </SelectItem>
                                            )}
                                            <ActionOwnerOptions
                                                members={members}
                                            />
                                        </SelectContent>
                                    </Select>
                                )}
                                {onLinkTicket && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="max-w-full min-w-0"
                                        onClick={onLinkTicket}
                                    >
                                        <LinkIcon aria-hidden />
                                        <span className="truncate">
                                            {t('Link a ticket')}
                                        </span>
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="min-w-0"
                                    disabled={draftTitle.trim() === '' || busy}
                                    onClick={save}
                                >
                                    <span className="truncate">
                                        {t('Save')}
                                    </span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="min-w-0"
                                    onClick={cancel}
                                >
                                    <span className="truncate">
                                        {t('Cancel')}
                                    </span>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p
                            id={titleId}
                            data-slot="action-item-title"
                            className={cn(
                                'text-sm leading-5 font-semibold break-words',
                                isCompleted &&
                                    'text-muted-foreground line-through',
                            )}
                        >
                            {title}
                        </p>
                    )}
                    <div
                        data-slot="action-item-meta"
                        hidden={editing}
                        className={cn(
                            'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
                            editing && 'hidden',
                        )}
                    >
                        <ActionPriorityMark
                            priority={priority}
                            label={labels.priority[priority]}
                        />
                        {isCompleted && doneAt && (
                            <span className="inline-flex items-center gap-1">
                                <CircleCheck aria-hidden className="size-3.5" />
                                {t('Done on :date', {
                                    date: formatActionDay(doneAt, locale),
                                })}
                            </span>
                        )}
                        {isCompleted && completedVia && (
                            <span data-slot="action-item-completed-via">
                                {t('Completed in :source', {
                                    source: TrackerLabels[completedVia],
                                })}
                            </span>
                        )}
                        {!isCompleted && overdue && (
                            <span
                                data-slot="action-item-due"
                                className="inline-flex items-center gap-1 font-semibold text-skrum-destructive-text"
                            >
                                <CalendarClock
                                    aria-hidden
                                    className="size-3.5"
                                />
                                {dueDate
                                    ? t('Overdue · :date', {
                                          date: formatActionDay(
                                              dueDate,
                                              locale,
                                          ),
                                      })
                                    : t('Overdue')}
                            </span>
                        )}
                        {!isCompleted && !overdue && (
                            <span
                                data-slot="action-item-due"
                                className="inline-flex items-center gap-1"
                            >
                                <CalendarIcon
                                    aria-hidden
                                    className="size-3.5"
                                />
                                {dueDate
                                    ? t('Due :date', {
                                          date: formatActionDay(
                                              dueDate,
                                              locale,
                                          ),
                                      })
                                    : t('No due date')}
                            </span>
                        )}
                        {recurrence && (
                            <span
                                data-slot="action-item-recurrence"
                                className="inline-flex min-w-0 items-center gap-1"
                            >
                                <Repeat
                                    aria-hidden
                                    className="size-3.5 shrink-0"
                                />
                                <span className="min-w-0 break-words">
                                    {labels.repeats[recurrence]}
                                    {followUpDate &&
                                        ` · ${t(
                                            'Follows up the item completed on :date',
                                            {
                                                date: formatActionDay(
                                                    followUpDate,
                                                    locale,
                                                ),
                                            },
                                        )}`}
                                </span>
                            </span>
                        )}
                        {subtasks && subtasks.length > 0 && (
                            <span
                                data-slot="action-item-subtasks"
                                className="inline-flex items-center gap-1"
                            >
                                <ListChecks aria-hidden className="size-3.5" />
                                <span aria-hidden className="tabular-nums">
                                    {doneSubtasks}/{subtasks.length}
                                </span>
                                <span className="sr-only">
                                    {t(':done of :total sub-tasks done', {
                                        done: doneSubtasks,
                                        total: subtasks.length,
                                    })}
                                </span>
                            </span>
                        )}
                        {commentCount !== undefined && !onToggleComments && (
                            <span className="inline-flex items-center gap-1">
                                <MessageSquare
                                    aria-hidden
                                    className="size-3.5"
                                />
                                {commentsLabel}
                            </span>
                        )}
                        {createdBy !== undefined && (
                            <span
                                data-slot="action-item-creator"
                                className="inline-flex max-w-full min-w-0 items-center gap-1"
                            >
                                <PersonAvatar
                                    decorative
                                    size="xs"
                                    name={createdBy?.name ?? t('Former member')}
                                    src={createdBy?.avatarUrl}
                                />
                                <span className="truncate">
                                    {createdBy?.name ?? t('Former member')}
                                </span>
                            </span>
                        )}
                        {showOwnerName && owner && (
                            <span
                                data-slot="action-item-owner-name"
                                className="inline-flex max-w-full min-w-0 items-center gap-1"
                            >
                                <span className="truncate">
                                    {labels.ownerName(owner)}
                                </span>
                            </span>
                        )}
                        {themeName && (
                            <Badge
                                variant="outline"
                                className="max-w-full shrink font-normal"
                            >
                                <span className="truncate">
                                    {t('Theme: :name', { name: themeName })}
                                </span>
                            </Badge>
                        )}
                        {teamName && (
                            <span className="inline-flex max-w-full min-w-0 items-center gap-1">
                                <Users
                                    aria-hidden
                                    className="size-3.5 shrink-0"
                                />
                                <span className="truncate">{teamName}</span>
                            </span>
                        )}
                        {source && source.url && (
                            <Link
                                href={source.url}
                                data-slot="action-item-source"
                                className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-xs underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                                {sourceLabel}
                            </Link>
                        )}
                        {source && !source.url && (
                            <span
                                data-slot="action-item-source"
                                className="inline-flex max-w-full min-w-0 items-center gap-1"
                            >
                                {sourceLabel}
                            </span>
                        )}
                        {meta}
                    </div>
                </div>
                {!editing && (
                    <div
                        data-slot="action-item-side"
                        className="flex max-w-1/2 min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 @max-action-stack/action:max-w-none @max-action-stack/action:basis-full @max-action-stack/action:justify-start @max-action-stack/action:gap-2 @max-action-stack/action:pl-8"
                    >
                        <ActionStatusBadge status={status} overdue={overdue} />
                        {links?.map((link) => (
                            <ActionItemLinkChip
                                key={link.id}
                                link={link}
                                locale={locale}
                                disabled={busy}
                                onRetrySync={onRetrySync}
                            />
                        ))}
                        {(links === null || links.length === 0) &&
                            onLinkTicket && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="max-w-full min-w-0"
                                    onClick={onLinkTicket}
                                >
                                    <LinkIcon aria-hidden />
                                    <span className="truncate">
                                        {t('Link a ticket')}
                                    </span>
                                </Button>
                            )}
                        {owner ? (
                            <PersonAvatar
                                name={owner.name}
                                kind={owner.kind}
                                presence={owner.presence}
                                src={owner.avatarUrl}
                                size="sm"
                                className="@max-action-stack/action:order-first"
                            />
                        ) : (
                            <span
                                role="img"
                                aria-label={t('Unassigned')}
                                title={t('Unassigned')}
                                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-input bg-card text-muted-foreground @max-action-stack/action:order-first"
                            >
                                <UserPlus aria-hidden className="size-3.5" />
                            </span>
                        )}
                        {(actions || onEditStart || onDelete) && (
                            <div
                                data-slot="action-item-actions"
                                className="flex max-w-full min-w-0 items-center gap-1"
                            >
                                {actions}
                                {onEditStart && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                ref={editButtonRef}
                                                type="button"
                                                size="icon-sm"
                                                variant="ghost"
                                                className="shrink-0"
                                                disabled={busy}
                                                aria-label={t(
                                                    'Edit action item',
                                                )}
                                                onClick={onEditStart}
                                            >
                                                <Pencil aria-hidden />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent shortcut={[t('Enter')]}>
                                            {t('Edit action item')}
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                {onDelete && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="min-w-0 text-skrum-destructive-text"
                                        disabled={busy}
                                        aria-label={t('Delete action item')}
                                        onClick={onDelete}
                                    >
                                        <Trash2 aria-hidden />
                                        <span className="truncate">
                                            {t('Delete')}
                                        </span>
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {hasDetails && (
                <div
                    data-slot="action-item-details"
                    className="flex min-w-0 flex-col items-start gap-2 border-t px-3.5 py-3 pl-11.5"
                >
                    {children && (
                        <div className="w-full min-w-0">{children}</div>
                    )}
                    {commentCount !== undefined && onToggleComments && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="max-w-full min-w-0"
                            aria-expanded={commentsOpen}
                            aria-controls={commentsId}
                            onClick={onToggleComments}
                        >
                            <MessageSquare aria-hidden />
                            <span className="truncate">{commentsLabel}</span>
                        </Button>
                    )}
                    {commentsOpen && comments && (
                        <div
                            id={commentsId}
                            data-slot="action-item-comments"
                            className="w-full min-w-0"
                        >
                            {comments}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
