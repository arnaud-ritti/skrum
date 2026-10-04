import { Link } from '@inertiajs/react';
import {
    Calendar,
    CalendarClock,
    ChevronDown,
    CircleCheck,
    Ellipsis,
    Hourglass,
    Pencil,
    Repeat,
    StickyNote,
    Trash2,
    UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActionItemGroupMeta } from '@/components/action-items/action-item-group-meta';
import { toActionItemData } from '@/components/action-items/action-item-adapters';
import { ItemExport } from '@/components/action-items/item-export';
import type { IntegrationScope } from '@/components/action-items/item-export';
import {
    ActionItemLinkChip,
    ActionPriorityMark,
    ActionStatusBadge,
    formatActionDay,
    nextActionStatus,
    useActionItemLabels,
} from '@/components/skrum/action-item';
import type {
    ActionItemLink,
    ActionItemOwner,
} from '@/components/skrum/action-item';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableEmpty,
    TableHead,
    TableHeader,
    TableLoading,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import {
    actionDueState,
    formatDaysLeft,
    formatDueDay,
} from '@/lib/action-items/due';
import type { ActionItemGroup } from '@/lib/action-items/grouping';
import { canManageActionItem } from '@/lib/action-items/permissions';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import type { ActionItem, ActionItemStatus } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import type { ExportSource } from '@/types/integrations';

const ColumnCount = 8;

/** What a row needs from the page, whatever lists it: the table or the phone list. */
export type ActionItemRowContext = {
    viewer: ActionItemViewer;
    locale: string;
    /** The day of the viewer, `YYYY-MM-DD`. */
    today: string;
    /** No team filter is on: a row names its team. */
    showTeam: boolean;
    teamName: (teamId: string) => string | undefined;
    membersOf: (teamId: string) => ActionItemOwner[];
    scope: IntegrationScope;
    sourcesOf: (teamId: string) => ExportSource[];
    busyId: string | null;
    onStatusChange: (item: ActionItem, status: ActionItemStatus) => void;
    onDelete: (item: ActionItem) => void;
    onRetrySync: (item: ActionItem, link: ActionItemLink) => void;
};

type Props = {
    groups: ActionItemGroup[];
    context: ActionItemRowContext;
    /** The list has more than one page: a group counts the rows of this one. */
    paged?: boolean;
    /** A filter visit is in flight. */
    loading?: boolean;
    /** What the table says when it has no row. */
    empty?: ReactNode;
    /** Under the rows, inside the card: the pagination. */
    footer?: ReactNode;
    /** The selection box of a row, in the first column; empty without it. */
    selectionCell?: (item: ActionItem) => ReactNode;
    /** The "select all" box, in the header of the first column. */
    selectionHead?: ReactNode;
    /** The box of a group row, which selects the group's rows. */
    selectionGroup?: (group: ActionItemGroup) => ReactNode;
    /** A selected row has the selected background. */
    isSelected?: (item: ActionItem) => boolean;
    'aria-label'?: string;
    onOpen: (item: ActionItem) => void;
};

const focusRing =
    'outline-ring focus-visible:outline-2 focus-visible:outline-offset-2';

function DueCell({
    item,
    context,
}: {
    item: ActionItem;
    context: ActionItemRowContext;
}) {
    const { t } = useTrans();
    const labels = useActionItemLabels();
    const { locale, today } = context;
    const { state, days } = actionDueState(item, today);
    const base = 'inline-flex items-center gap-1 whitespace-nowrap';
    const recurrence = item.recurrence && (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    role="img"
                    tabIndex={0}
                    data-slot="action-row-recurrence"
                    aria-label={labels.repeats[item.recurrence]}
                    className={cn(
                        'inline-flex shrink-0 rounded-xs text-muted-foreground',
                        focusRing,
                    )}
                >
                    <Repeat aria-hidden className="size-3.5" />
                </span>
            </TooltipTrigger>
            <TooltipContent>{labels.repeats[item.recurrence]}</TooltipContent>
        </Tooltip>
    );

    return (
        <span
            data-slot="action-row-due"
            data-due={state}
            className="inline-flex items-center gap-1.5 text-body-sm"
        >
            {state === 'done' && (
                <span className={cn(base, 'text-muted-foreground')}>
                    <CircleCheck aria-hidden className="size-3.5 shrink-0" />
                    {item.completedAt
                        ? t('Done on :date', {
                              date: formatActionDay(item.completedAt, locale),
                          })
                        : t('Done status')}
                </span>
            )}
            {state === 'overdue' && item.dueOn && (
                <span
                    className={cn(
                        base,
                        'font-semibold text-skrum-destructive-text',
                    )}
                >
                    <CalendarClock aria-hidden className="size-3.5 shrink-0" />
                    {t('Overdue · :date', {
                        date: formatActionDay(item.dueOn, locale),
                    })}
                </span>
            )}
            {state === 'soon' && item.dueOn && days !== null && (
                <span
                    className={cn(
                        base,
                        'font-semibold text-skrum-warning-text',
                    )}
                >
                    <Hourglass aria-hidden className="size-3.5 shrink-0" />
                    {formatDueDay(item.dueOn, locale)} ·{' '}
                    {formatDaysLeft(days, locale)}
                </span>
            )}
            {state === 'later' && item.dueOn && (
                <span className={base}>
                    <Calendar
                        aria-hidden
                        className="size-3.5 shrink-0 text-muted-foreground"
                    />
                    {formatDueDay(item.dueOn, locale)}
                </span>
            )}
            {state === 'none' && (
                <span className={cn(base, 'text-muted-foreground')}>
                    {t('No due date')}
                </span>
            )}
            {state !== 'done' && recurrence}
        </span>
    );
}

function Row({
    item,
    context,
    selection,
    selected,
    onOpen,
}: {
    item: ActionItem;
    context: ActionItemRowContext;
    selection?: ReactNode;
    selected: boolean;
    onOpen: (item: ActionItem) => void;
}) {
    const { t } = useTrans();
    const labels = useActionItemLabels();
    const { canComplete, ...data } = toActionItemData(item, {
        locale: context.locale,
        viewer: context.viewer,
    });
    const manages = canManageActionItem(item, context.viewer);
    const busy = context.busyId === item.id;
    const nextStatus = nextActionStatus(item.status, true);
    const statusAction = labels.statusAction[nextStatus];
    const titleId = `action-item-title-${item.id}`;
    const statusId = `action-item-status-${item.id}`;
    const sourceLabel = data.source?.label ?? t('Added outside a retro');
    const teamName = context.showTeam
        ? context.teamName(item.teamId)
        : undefined;
    const links = item.externalLinks ?? [];
    const sources = manages ? context.sourcesOf(item.teamId) : [];

    return (
        <TableRow
            id={`action-item-${item.id}`}
            data-slot="action-row"
            data-status={item.status}
            data-selected={selected ? 'true' : undefined}
            selected={selected}
            done={item.status === 'completed'}
            late={item.isOverdue}
            aria-busy={busy ? true : undefined}
        >
            <TableCell className="w-10">{selection}</TableCell>
            <TableCell className="min-w-48">
                <div className="flex min-w-0 flex-col items-start gap-0.5">
                    <button
                        type="button"
                        id={titleId}
                        data-slot="action-row-title"
                        aria-haspopup="dialog"
                        onClick={() => onOpen(item)}
                        className={cn(
                            'max-w-full rounded-xs text-left leading-5 font-semibold wrap-anywhere hover:underline',
                            focusRing,
                            item.status === 'completed' &&
                                'text-muted-foreground line-through',
                        )}
                    >
                        {item.content}
                    </button>
                    <span
                        data-slot="action-row-source"
                        className="inline-flex max-w-full min-w-0 items-center gap-1 text-xs text-muted-foreground"
                    >
                        <StickyNote aria-hidden className="size-3 shrink-0" />
                        {teamName && (
                            <span className="shrink-0">{teamName} ·</span>
                        )}
                        {data.source?.url ? (
                            <Link
                                href={data.source.url}
                                className={cn(
                                    'min-w-0 truncate rounded-xs underline-offset-4 hover:underline',
                                    focusRing,
                                )}
                            >
                                {sourceLabel}
                            </Link>
                        ) : (
                            <span className="min-w-0 truncate">
                                {sourceLabel}
                            </span>
                        )}
                    </span>
                </div>
            </TableCell>
            <TableCell>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            data-slot="action-row-status"
                            aria-label={statusAction}
                            aria-describedby={statusId}
                            aria-disabled={canComplete ? undefined : true}
                            disabled={busy}
                            onClick={() => {
                                if (canComplete) {
                                    context.onStatusChange(item, nextStatus);
                                }
                            }}
                            className={cn(
                                'inline-flex rounded-full disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
                                focusRing,
                            )}
                        >
                            <span id={statusId} className="inline-flex">
                                <ActionStatusBadge
                                    status={item.status}
                                    overdue={false}
                                />
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {canComplete
                            ? statusAction
                            : t('You cannot change this action item')}
                    </TooltipContent>
                </Tooltip>
            </TableCell>
            <TableCell>
                {data.owner ? (
                    <span
                        data-slot="action-row-owner"
                        className="inline-flex max-w-48 min-w-0 items-center gap-2 text-body-sm"
                    >
                        <PersonAvatar
                            decorative
                            size="xs"
                            name={data.owner.name}
                            kind={data.owner.kind}
                            src={data.owner.avatarUrl}
                        />
                        <span className="truncate">
                            {labels.ownerName(data.owner)}
                        </span>
                    </span>
                ) : (
                    <span
                        data-slot="action-row-owner"
                        className="inline-flex items-center gap-2 text-body-sm whitespace-nowrap text-muted-foreground"
                    >
                        <span
                            aria-hidden
                            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-input bg-card"
                        >
                            <UserPlus className="size-3" />
                        </span>
                        {t('Unassigned')}
                    </span>
                )}
            </TableCell>
            <TableCell className="whitespace-nowrap">
                <ActionPriorityMark
                    priority={item.priority}
                    label={labels.priority[item.priority]}
                />
            </TableCell>
            <TableCell>
                <DueCell item={item} context={context} />
            </TableCell>
            <TableCell>
                <span
                    data-slot="action-row-ticket"
                    className="inline-flex min-w-0 flex-wrap items-center gap-1"
                >
                    {links.map((link) => (
                        <ActionItemLinkChip
                            key={link.id}
                            link={link}
                            locale={context.locale}
                            disabled={busy}
                            onRetrySync={
                                manages
                                    ? (failed) =>
                                          context.onRetrySync(item, failed)
                                    : undefined
                            }
                        />
                    ))}
                    {sources.length > 0 && (
                        <ItemExport
                            item={item}
                            sources={sources}
                            scope={context.scope}
                        />
                    )}
                    {links.length === 0 && sources.length === 0 && (
                        <span
                            aria-hidden
                            className="text-xs text-muted-foreground"
                        >
                            —
                        </span>
                    )}
                </span>
            </TableCell>
            <TableCell className="w-10">
                {manages && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={t('More actions')}
                                aria-describedby={titleId}
                                disabled={busy}
                            >
                                <Ellipsis aria-hidden />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                aria-label={t('Edit action item')}
                                onSelect={() => onOpen(item)}
                            >
                                <Pencil aria-hidden />
                                {t('Edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                variant="destructive"
                                aria-label={t('Delete action item')}
                                onSelect={() => context.onDelete(item)}
                            >
                                <Trash2 aria-hidden />
                                {t('Delete')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </TableCell>
        </TableRow>
    );
}

/**
 * The action items of a page as a table in a card. A group is a header row
 * that folds, with the count of its rows.
 */
export function ActionItemsTable({
    groups,
    context,
    paged = false,
    loading = false,
    empty,
    footer,
    selectionCell,
    selectionHead,
    selectionGroup,
    isSelected,
    'aria-label': ariaLabel,
    onOpen,
}: Props) {
    const { t } = useTrans();
    const [folded, setFolded] = useState<Set<string>>(new Set());

    const toggle = (key: string): void =>
        setFolded((current) => {
            const next = new Set(current);

            if (!next.delete(key)) {
                next.add(key);
            }

            return next;
        });

    const countLabel = (count: number): string => {
        const label =
            count === 1
                ? t('1 action item')
                : t(':count action items', { count });

        return paged ? `${label} · ${t('on this page')}` : label;
    };

    return (
        <div
            data-slot="action-items-table"
            className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-card"
        >
            <Table aria-label={ariaLabel} aria-busy={loading || undefined}>
                <TableHeader className="bg-muted">
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10">
                            {selectionHead ?? (
                                <span className="sr-only">{t('Select')}</span>
                            )}
                        </TableHead>
                        <TableHead>{t('Action')}</TableHead>
                        <TableHead className="w-25">{t('Status')}</TableHead>
                        <TableHead className="w-34">{t('Assignee')}</TableHead>
                        <TableHead className="w-25">{t('Priority')}</TableHead>
                        <TableHead className="w-42.5">{t('Due')}</TableHead>
                        <TableHead className="w-37.5">{t('Ticket')}</TableHead>
                        <TableHead className="w-10">
                            <span className="sr-only">{t('More')}</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && <TableLoading columns={ColumnCount} />}
                    {!loading && groups.length === 0 && (
                        <TableEmpty colSpan={ColumnCount}>{empty}</TableEmpty>
                    )}
                    {!loading &&
                        groups.map((group) => {
                            const open = !folded.has(group.key);
                            const rows = group.items.map((item) => (
                                <Row
                                    key={item.id}
                                    item={item}
                                    context={context}
                                    selection={selectionCell?.(item)}
                                    selected={isSelected?.(item) ?? false}
                                    onOpen={onOpen}
                                />
                            ));

                            if (group.label === '') {
                                return rows;
                            }

                            return [
                                <TableRow
                                    key={`group-${group.key}`}
                                    data-slot="action-group"
                                    className="bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))] hover:bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))]"
                                >
                                    <TableCell className="w-10">
                                        {selectionGroup?.(group)}
                                    </TableCell>
                                    <TableCell
                                        colSpan={ColumnCount - 1}
                                        className="py-2"
                                    >
                                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
                                            <button
                                                type="button"
                                                aria-expanded={open}
                                                onClick={() =>
                                                    toggle(group.key)
                                                }
                                                className={cn(
                                                    'inline-flex max-w-full min-w-0 items-center gap-2 rounded-xs font-semibold',
                                                    focusRing,
                                                )}
                                            >
                                                <ChevronDown
                                                    aria-hidden
                                                    className={cn(
                                                        'size-3.5 shrink-0 transition-transform duration-220 ease-standard motion-reduce:transition-none',
                                                        !open && '-rotate-90',
                                                    )}
                                                />
                                                <span className="truncate">
                                                    {group.label}
                                                </span>
                                            </button>
                                            <ActionItemGroupMeta
                                                group={group}
                                                countLabel={countLabel}
                                            />
                                        </span>
                                    </TableCell>
                                </TableRow>,
                                ...(open ? rows : []),
                            ];
                        })}
                </TableBody>
            </Table>
            {footer}
        </div>
    );
}
