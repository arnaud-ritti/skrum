import {
    CalendarClock,
    CalendarIcon,
    CircleCheck,
    ExternalLink,
    Link as LinkIcon,
    StickyNote,
    UserPlus,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PersonAvatar } from '@/components/ui/avatar';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type ActionItemStatus = 'open' | 'doing' | 'completed';
export type ActionItemPriority = 'low' | 'medium' | 'high';
export type ActionItemTicketProvider = 'jira' | 'linear';

export type ActionItemOwner = {
    id: string;
    name: string;
    presence?: ComponentProps<typeof PersonAvatar>['presence'];
    avatarUrl?: string | null;
};

export type ActionItemPatch = {
    title?: string;
    priority?: ActionItemPriority;
    dueDate?: string | null;
    owner?: ActionItemOwner | null;
};

export type ActionItemProps = {
    id: string;
    title: string;
    status: ActionItemStatus;
    priority: ActionItemPriority;
    dueDate?: string | null;
    doneAt?: string | null;
    owner?: ActionItemOwner | null;
    source?: { retroId: string; label: string };
    ticket?: {
        provider: ActionItemTicketProvider;
        key: string;
        url: string;
    } | null;
    editing?: boolean;
    members?: ActionItemOwner[];
    withDoing?: boolean;
    today?: string;
    locale?: string;
    onStatusChange?: (status: ActionItemStatus) => void;
    onChange?: (patch: ActionItemPatch) => void;
    onEditStart?: () => void;
    onEditCancel?: () => void;
    onLinkTicket?: () => void;
    className?: string;
};

const providerLabels: Record<ActionItemTicketProvider, string> = {
    jira: 'Jira',
    linear: 'Linear',
};

const priorityStyles: Record<
    ActionItemPriority,
    { text: string; bars: number }
> = {
    low: { text: 'text-muted-foreground', bars: 1 },
    medium: { text: 'text-skrum-warning-text', bars: 2 },
    high: { text: 'text-skrum-destructive-text', bars: 3 },
};

const barHeights = ['h-1.5', 'h-2.5', 'h-3.5'];

function formatDay(iso: string, locale: string): string {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
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

function PriorityMark({
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

export function ActionItem({
    id,
    title,
    status,
    priority,
    dueDate = null,
    doneAt = null,
    owner = null,
    source,
    ticket = null,
    editing = false,
    members,
    withDoing = false,
    today,
    locale = typeof document === 'undefined'
        ? 'en'
        : document.documentElement.lang || 'en',
    onStatusChange,
    onChange,
    onEditStart,
    onEditCancel,
    onLinkTicket,
    className,
}: ActionItemProps) {
    const { t } = useTrans();
    const titleId = useId();
    const [draftTitle, setDraftTitle] = useState(title);
    const [draftPriority, setDraftPriority] = useState(priority);
    const [draftDue, setDraftDue] = useState(dueDate?.slice(0, 10) ?? '');
    const [draftOwnerId, setDraftOwnerId] = useState(owner?.id ?? 'none');
    const wasEditing = useRef(editing);

    if (editing && !wasEditing.current) {
        setDraftTitle(title);
        setDraftPriority(priority);
        setDraftDue(dueDate?.slice(0, 10) ?? '');
        setDraftOwnerId(owner?.id ?? 'none');
    }

    wasEditing.current = editing;

    const isCompleted = status === 'completed';
    const overdue = isActionOverdue(dueDate, status, today ?? todayIso());
    const nextStatus = nextActionStatus(status, withDoing);

    const statusLabels: Record<ActionItemStatus, string> = {
        open: t('To do'),
        doing: t('In progress'),
        completed: t('Done'),
    };
    const priorityLabels: Record<ActionItemPriority, string> = {
        low: t('Low'),
        medium: t('Medium'),
        high: t('High'),
    };

    const statusButtonLabel = t('Status: :status. Mark as :next', {
        status: statusLabels[status],
        next: statusLabels[nextStatus],
    });

    const save = (): void => {
        const trimmed = draftTitle.trim();

        if (trimmed === '') {
            return;
        }

        const patch: ActionItemPatch = {
            title: trimmed,
            priority: draftPriority,
            dueDate: draftDue === '' ? null : draftDue,
        };

        if (members) {
            patch.owner =
                members.find((member) => member.id === draftOwnerId) ?? null;
        }

        onChange?.(patch);
    };

    const handleEditKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onEditCancel?.();

            return;
        }

        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            save();
        }
    };

    const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.target !== event.currentTarget) {
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            onEditStart?.();

            return;
        }

        if (event.key === ' ') {
            event.preventDefault();
            onStatusChange?.(nextStatus);
        }
    };

    const ticketLabel = ticket
        ? `${providerLabels[ticket.provider]} · ${ticket.key}`
        : '';

    const ownerNode: ReactNode = owner ? (
        <PersonAvatar
            name={owner.name}
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
    );

    return (
        <div
            role="listitem"
            data-slot="action-item"
            data-status={status}
            data-overdue={overdue ? 'true' : undefined}
            data-editing={editing ? 'true' : undefined}
            aria-labelledby={titleId}
            tabIndex={editing ? undefined : 0}
            onKeyDown={editing ? handleEditKeyDown : handleRowKeyDown}
            className={cn(
                '@container/action rounded-lg border bg-card outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                overdue && 'border-skrum-destructive-text',
                className,
            )}
            data-id={id}
        >
            <div className="flex flex-wrap items-start gap-3 px-3.5 py-3">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            data-slot="action-item-status"
                            aria-label={statusButtonLabel}
                            onClick={() => onStatusChange?.(nextStatus)}
                            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                            <StatusIcon status={status} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {statusButtonLabel} · {t('Space')}
                    </TooltipContent>
                </Tooltip>
                <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
                    {editing ? (
                        <div
                            data-slot="action-item-editor"
                            className="flex flex-col gap-2"
                        >
                            <Input
                                autoFocus
                                aria-label={t('Action title')}
                                value={draftTitle}
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
                                                {priorityLabels[value]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    type="date"
                                    aria-label={t('Due date')}
                                    value={draftDue}
                                    onChange={(event) =>
                                        setDraftDue(event.target.value)
                                    }
                                    className="w-auto"
                                />
                                {members && (
                                    <Select
                                        value={draftOwnerId}
                                        onValueChange={setDraftOwnerId}
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            aria-label={t('Owner')}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">
                                                {t('Unassigned')}
                                            </SelectItem>
                                            {members.map((member) => (
                                                <SelectItem
                                                    key={member.id}
                                                    value={member.id}
                                                >
                                                    {member.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                {onLinkTicket && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={onLinkTicket}
                                    >
                                        <LinkIcon aria-hidden />
                                        <span className="truncate">
                                            {ticket
                                                ? ticket.key
                                                : t('Link a ticket')}
                                        </span>
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={draftTitle.trim() === ''}
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
                                    onClick={onEditCancel}
                                >
                                    <span className="truncate">
                                        {t('Cancel')}
                                    </span>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
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
                            <div
                                data-slot="action-item-meta"
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                            >
                                <PriorityMark
                                    priority={priority}
                                    label={priorityLabels[priority]}
                                />
                                {isCompleted && doneAt && (
                                    <span className="inline-flex items-center gap-1">
                                        <CircleCheck
                                            aria-hidden
                                            className="size-3.5"
                                        />
                                        {t('Done on :date', {
                                            date: formatDay(doneAt, locale),
                                        })}
                                    </span>
                                )}
                                {!isCompleted && overdue && dueDate && (
                                    <span
                                        data-slot="action-item-due"
                                        className="inline-flex items-center gap-1 font-semibold text-skrum-destructive-text"
                                    >
                                        <CalendarClock
                                            aria-hidden
                                            className="size-3.5"
                                        />
                                        {t('Overdue · :date', {
                                            date: formatDay(dueDate, locale),
                                        })}
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
                                            ? formatDay(dueDate, locale)
                                            : t('No due date')}
                                    </span>
                                )}
                                {source && (
                                    <span className="inline-flex min-w-0 items-center gap-1">
                                        <StickyNote
                                            aria-hidden
                                            className="size-3.5 shrink-0"
                                        />
                                        <span className="truncate">
                                            {source.label}
                                        </span>
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
                {!editing && (
                    <div
                        data-slot="action-item-side"
                        className="flex shrink-0 items-center gap-3 self-center @max-action-stack/action:basis-full @max-action-stack/action:flex-wrap @max-action-stack/action:gap-2 @max-action-stack/action:self-start @max-action-stack/action:pl-8.5"
                    >
                        {overdue ? (
                            <Badge variant="destructive" shape="pill">
                                {t('Overdue')}
                            </Badge>
                        ) : (
                            <Badge
                                shape="pill"
                                variant={
                                    status === 'completed'
                                        ? 'success'
                                        : status === 'doing'
                                          ? 'info'
                                          : 'outline'
                                }
                            >
                                {statusLabels[status]}
                            </Badge>
                        )}
                        {ticket ? (
                            <a
                                href={ticket.url}
                                target="_blank"
                                rel="noopener"
                                aria-label={t('Open :key in :provider', {
                                    key: ticket.key,
                                    provider: providerLabels[ticket.provider],
                                })}
                                className="inline-flex items-center gap-1 rounded-xs border bg-muted px-1.5 font-mono text-xs leading-5 font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                                <ExternalLink
                                    aria-hidden
                                    className="size-3.5"
                                />
                                {ticketLabel}
                            </a>
                        ) : (
                            onLinkTicket && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={onLinkTicket}
                                >
                                    <LinkIcon aria-hidden />
                                    <span className="truncate">
                                        {t('Link a ticket')}
                                    </span>
                                </Button>
                            )
                        )}
                        {ownerNode}
                    </div>
                )}
            </div>
        </div>
    );
}
