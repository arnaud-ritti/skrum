import { Link } from '@inertiajs/react';
import {
    CalendarDays,
    CircleDot,
    Eye,
    Flag,
    Pencil,
    Repeat,
    StickyNote,
    Tag,
    Trash2,
    User,
    UserPen,
    Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
    ActionItemLinkChip,
    ActionItemRecurrences,
    ActionPriorityMark,
    ActionStatusIcon,
    ActionStatusBadge,
    actionOwnerValue,
    defaultActionLocale,
    formatActionDay,
    nextActionStatus,
    resolveActionOverdue,
    useActionItemLabels,
    useActionLinkSummary,
} from '@/components/skrum/action-item';
import type {
    ActionItemData,
    ActionItemLink,
    ActionItemOwner,
    ActionItemPriority,
    ActionItemRecurrence,
    ActionItemStatus,
} from '@/components/skrum/action-item';
import { DueDatePicker } from '@/components/skrum/due-date-picker';
import { Alert } from '@/components/ui/alert';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetProperties,
    SheetProperty,
    SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { TrackerLabels } from '@/lib/poker/types';
import { cn } from '@/lib/utils';

export type ActionSheetField =
    | 'title'
    | 'status'
    | 'priority'
    | 'dueDate'
    | 'owner'
    | 'recurrence';

export type ActionSheetProps = ActionItemData & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    side?: 'right' | 'left';
    /** Guests and viewers without rights: no editable field, no footer. */
    readOnly?: boolean;
    /** The viewer may complete or reopen (assignee, reviewer, manager). */
    canComplete?: boolean;
    /** The field whose save is in flight. */
    savingField?: ActionSheetField | null;
    /** The item was removed elsewhere while the sheet was open. */
    deleted?: boolean;
    titleMaxLength?: number;
    watchers?: ActionItemOwner[];
    /** Footer actions wired by the page, such as the export menu. */
    actions?: ReactNode;
    /** The sub-task checklist. */
    children?: ReactNode;
    /** The comment thread. */
    comments?: ReactNode;
    /** The retro card the action comes from. */
    originCard?: ReactNode;
    history?: ReactNode;
    /** When the item was put in progress; shown until it is done. */
    startedAt?: string | null;
};

const NoOwner = 'none';
const NoRecurrence = 'none';

function SavingMark({ active }: { active: boolean }) {
    const { t } = useTrans();

    if (!active) {
        return null;
    }

    return (
        <Spinner
            aria-label={t('Saving…')}
            className="size-3.5 shrink-0 text-muted-foreground motion-reduce:animate-none"
        />
    );
}

function Section({
    title,
    aside,
    children,
}: {
    title: string;
    aside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
                <h3 className="min-w-0 truncate text-body-sm font-semibold text-foreground">
                    {title}
                </h3>
                {aside}
            </div>
            {children}
        </section>
    );
}

function LinkRow({
    link,
    locale,
    disabled,
    onRetrySync,
}: {
    link: ActionItemLink;
    locale: string;
    disabled: boolean;
    onRetrySync?: (link: ActionItemLink) => void;
}) {
    const { summary, needsAttention } = useActionLinkSummary(link);

    return (
        <li className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <ActionItemLinkChip
                link={link}
                locale={locale}
                disabled={disabled}
                onRetrySync={onRetrySync}
            />
            {summary && (
                <span
                    aria-hidden
                    className={cn(
                        'min-w-0 text-xs break-words text-muted-foreground',
                        needsAttention && 'text-skrum-warning-text',
                    )}
                >
                    {summary}
                </span>
            )}
        </li>
    );
}

function OwnerLine({ owner }: { owner: ActionItemOwner }) {
    const labels = useActionItemLabels();

    return (
        <span className="flex min-w-0 items-center gap-2 text-sm">
            <PersonAvatar
                decorative
                size="sm"
                name={owner.name}
                kind={owner.kind}
                presence={owner.presence}
                src={owner.avatarUrl}
            />
            <span className="truncate">{labels.ownerName(owner)}</span>
        </span>
    );
}

export function ActionSheet({
    open,
    onOpenChange,
    side = 'right',
    readOnly = false,
    canComplete = true,
    savingField = null,
    deleted = false,
    titleMaxLength = 500,
    watchers,
    actions,
    children,
    comments,
    originCard,
    history,
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
    startedAt = null,
    today,
    locale = defaultActionLocale(),
    onStatusChange,
    onChange,
    onDelete,
    onRetrySync,
}: ActionSheetProps) {
    const { t } = useTrans();
    const labels = useActionItemLabels();
    const openerRef = useRef<HTMLElement | null>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const editTitleRef = useRef<HTMLButtonElement>(null);
    const titleEditorClosed = useRef(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [draftTitle, setDraftTitle] = useState(title);
    const [draftDue, setDraftDue] = useState(dueDate?.slice(0, 10) ?? '');
    const [knownDue, setKnownDue] = useState(dueDate);
    const editable = !readOnly && !deleted && Boolean(onChange);

    if (editingTitle && (!open || !editable)) {
        setEditingTitle(false);
    }

    if (knownDue !== dueDate) {
        setKnownDue(dueDate);
        setDraftDue(dueDate?.slice(0, 10) ?? '');
    }

    useEffect(() => {
        if (editingTitle || !titleEditorClosed.current) {
            return;
        }

        titleEditorClosed.current = false;
        (editTitleRef.current ?? titleRef.current)?.focus();
    }, [editingTitle]);

    const completes =
        !readOnly && !deleted && canComplete && Boolean(onStatusChange);
    const isCompleted = status === 'completed';
    const overdue = resolveActionOverdue({
        overdue: overdueProp,
        dueDate,
        status,
        today,
    });
    const footerStatus = nextActionStatus(status, false);
    const statuses: ActionItemStatus[] =
        withDoing || status === 'doing'
            ? ['open', 'doing', 'completed']
            : ['open', 'completed'];
    const doneSubtasks =
        subtasks?.filter((subtask) => subtask.isCompleted).length ?? 0;
    const ownerIsListed =
        !owner ||
        (members ?? []).some(
            (member) => actionOwnerValue(member) === actionOwnerValue(owner),
        );
    const descriptionParts = [teamName, source?.label].filter(Boolean);
    const hasFooter =
        !readOnly &&
        (Boolean(onStatusChange) || Boolean(actions) || Boolean(onDelete));

    const closeTitleEditor = (): void => {
        titleEditorClosed.current = true;
        setEditingTitle(false);
    };

    const saveTitle = (): void => {
        const trimmed = draftTitle.trim();

        if (trimmed === '') {
            return;
        }

        if (trimmed !== title) {
            onChange?.({ title: trimmed });
        }

        closeTitleEditor();
    };

    const saveDueDate = (nextDue: string): void => {
        if (nextDue === draftDue) {
            return;
        }

        setDraftDue(nextDue);
        onChange?.(
            nextDue === ''
                ? { dueDate: null, ...(recurrence ? { recurrence: null } : {}) }
                : { dueDate: nextDue },
        );
    };

    const dueText = dueDate
        ? formatActionDay(dueDate, locale)
        : t('No due date');

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side={side}
                closeLabel={t('Close')}
                data-slot="action-sheet"
                data-status={status}
                data-overdue={overdue ? 'true' : undefined}
                data-readonly={readOnly ? 'true' : undefined}
                onOpenAutoFocus={(event) => {
                    openerRef.current =
                        document.activeElement instanceof HTMLElement
                            ? document.activeElement
                            : null;
                    event.preventDefault();
                    titleRef.current?.focus();
                }}
                onCloseAutoFocus={(event) => {
                    const opener = openerRef.current;

                    if (!opener || !opener.isConnected) {
                        return;
                    }

                    event.preventDefault();
                    opener.focus();
                }}
                onEscapeKeyDown={(event) => {
                    if (!editingTitle) {
                        return;
                    }

                    event.preventDefault();
                    closeTitleEditor();
                }}
            >
                <SheetHeader>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <ActionStatusBadge status={status} overdue={overdue} />
                        {readOnly && (
                            <Badge variant="muted" shape="pill" icon={Eye}>
                                {t('Read only')}
                            </Badge>
                        )}
                        {links?.slice(0, 1).map((link) => (
                            <ActionItemLinkChip
                                key={link.id}
                                link={link}
                                locale={locale}
                            />
                        ))}
                    </div>
                    <div className="-mr-10 flex min-w-0 items-start gap-2">
                        <SheetTitle
                            ref={titleRef}
                            tabIndex={-1}
                            className={cn(
                                'min-w-0 flex-1 rounded-xs break-words outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                                isCompleted &&
                                    'text-muted-foreground line-through',
                                editingTitle && 'sr-only',
                            )}
                        >
                            {title}
                        </SheetTitle>
                        {editable && !editingTitle && (
                            <Button
                                ref={editTitleRef}
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="shrink-0"
                                aria-label={t('Edit action item')}
                                onClick={() => {
                                    setDraftTitle(title);
                                    setEditingTitle(true);
                                }}
                            >
                                <Pencil aria-hidden className="size-3.5" />
                            </Button>
                        )}
                        <SavingMark active={savingField === 'title'} />
                    </div>
                    {editingTitle && (
                        <form
                            data-slot="action-sheet-title-editor"
                            className="-mr-8 flex min-w-0 flex-col gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                saveTitle();
                            }}
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
                            <div className="flex items-center gap-2">
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="min-w-0"
                                    disabled={draftTitle.trim() === ''}
                                >
                                    <span className="truncate">
                                        {t('Save')}
                                    </span>
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="min-w-0"
                                    onClick={closeTitleEditor}
                                >
                                    <span className="truncate">
                                        {t('Cancel')}
                                    </span>
                                </Button>
                            </div>
                        </form>
                    )}
                    <SheetDescription
                        className={cn(
                            'break-words',
                            descriptionParts.length === 0 && 'sr-only',
                        )}
                    >
                        {descriptionParts.length > 0
                            ? descriptionParts.join(' · ')
                            : t('Action details')}
                    </SheetDescription>
                </SheetHeader>
                <SheetBody>
                    {deleted && (
                        <Alert
                            variant="warning"
                            title={t('This action item was deleted.')}
                        />
                    )}
                    <SheetProperties>
                        <SheetProperty label={t('Status')} icon={<CircleDot />}>
                            <div className="flex min-w-0 items-center gap-2">
                                {completes ? (
                                    <Select
                                        value={status}
                                        onValueChange={(value) =>
                                            onStatusChange?.(
                                                value as ActionItemStatus,
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="max-w-full min-w-0"
                                            aria-label={t('Status')}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {statuses.map((value) => (
                                                <SelectItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    <ActionStatusIcon
                                                        status={value}
                                                        className="size-4"
                                                    />
                                                    {labels.status[value]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <span className="flex min-w-0 items-center gap-2 text-sm">
                                        <ActionStatusIcon
                                            status={status}
                                            className="size-4"
                                        />
                                        <span className="truncate">
                                            {labels.status[status]}
                                        </span>
                                    </span>
                                )}
                                <SavingMark active={savingField === 'status'} />
                            </div>
                            {status === 'doing' && startedAt && (
                                <p className="mt-1 text-xs break-words text-muted-foreground">
                                    {t('Started :date', {
                                        date: formatActionDay(
                                            startedAt,
                                            locale,
                                        ),
                                    })}
                                </p>
                            )}
                            {isCompleted && (doneAt || completedVia) && (
                                <p className="mt-1 text-xs break-words text-muted-foreground">
                                    {[
                                        doneAt &&
                                            t('Done on :date', {
                                                date: formatActionDay(
                                                    doneAt,
                                                    locale,
                                                ),
                                            }),
                                        completedVia &&
                                            t('Completed in :source', {
                                                source: TrackerLabels[
                                                    completedVia
                                                ],
                                            }),
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            )}
                        </SheetProperty>
                        <SheetProperty label={t('Assignee')} icon={<User />}>
                            <div className="flex min-w-0 items-center gap-2">
                                {editable && members ? (
                                    <Select
                                        value={actionOwnerValue(owner)}
                                        onValueChange={(value) =>
                                            onChange?.({
                                                owner:
                                                    members.find(
                                                        (member) =>
                                                            actionOwnerValue(
                                                                member,
                                                            ) === value,
                                                    ) ?? null,
                                            })
                                        }
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
                                                    <PersonAvatar
                                                        decorative
                                                        size="xs"
                                                        name={owner.name}
                                                        kind={owner.kind}
                                                        src={owner.avatarUrl}
                                                    />
                                                    {labels.ownerName(owner)}
                                                </SelectItem>
                                            )}
                                            {members.map((member) => (
                                                <SelectItem
                                                    key={actionOwnerValue(
                                                        member,
                                                    )}
                                                    value={actionOwnerValue(
                                                        member,
                                                    )}
                                                >
                                                    <PersonAvatar
                                                        decorative
                                                        size="xs"
                                                        name={member.name}
                                                        kind={member.kind}
                                                        src={member.avatarUrl}
                                                    />
                                                    {member.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : owner ? (
                                    <OwnerLine owner={owner} />
                                ) : (
                                    <span className="truncate text-sm text-muted-foreground">
                                        {t('Unassigned')}
                                    </span>
                                )}
                                <SavingMark active={savingField === 'owner'} />
                            </div>
                        </SheetProperty>
                        <SheetProperty
                            label={t('Due date')}
                            icon={<CalendarDays />}
                        >
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                {editable ? (
                                    <DueDatePicker
                                        value={draftDue}
                                        onValueChange={saveDueDate}
                                        locale={locale}
                                        className="w-auto max-w-full **:data-[slot=date-picker-trigger]:h-8"
                                    />
                                ) : (
                                    <span
                                        className={cn(
                                            'truncate text-sm',
                                            !dueDate && 'text-muted-foreground',
                                        )}
                                    >
                                        {dueText}
                                    </span>
                                )}
                                {overdue && (
                                    <span
                                        data-slot="action-sheet-overdue"
                                        className="text-xs font-semibold text-skrum-destructive-text"
                                    >
                                        {t('Overdue')}
                                    </span>
                                )}
                                <SavingMark
                                    active={savingField === 'dueDate'}
                                />
                            </div>
                        </SheetProperty>
                        <SheetProperty label={t('Priority')} icon={<Flag />}>
                            <div className="flex min-w-0 items-center gap-2">
                                {editable ? (
                                    <Select
                                        value={priority}
                                        onValueChange={(value) =>
                                            onChange?.({
                                                priority:
                                                    value as ActionItemPriority,
                                            })
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
                                                    <ActionPriorityMark
                                                        priority={value}
                                                        label={
                                                            labels.priority[
                                                                value
                                                            ]
                                                        }
                                                    />
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <ActionPriorityMark
                                        priority={priority}
                                        label={labels.priority[priority]}
                                    />
                                )}
                                <SavingMark
                                    active={savingField === 'priority'}
                                />
                            </div>
                        </SheetProperty>
                        {recurrence !== undefined &&
                            (editable || recurrence !== null) && (
                                <SheetProperty
                                    label={t('Repeat')}
                                    icon={<Repeat />}
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        {editable ? (
                                            <Select
                                                value={
                                                    recurrence ?? NoRecurrence
                                                }
                                                disabled={!dueDate}
                                                onValueChange={(value) =>
                                                    onChange?.({
                                                        recurrence:
                                                            value ===
                                                            NoRecurrence
                                                                ? null
                                                                : (value as ActionItemRecurrence),
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    size="sm"
                                                    className="max-w-full min-w-0"
                                                    aria-label={t('Repeat')}
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem
                                                        value={NoRecurrence}
                                                    >
                                                        {t('Does not repeat')}
                                                    </SelectItem>
                                                    {ActionItemRecurrences.map(
                                                        (value) => (
                                                            <SelectItem
                                                                key={value}
                                                                value={value}
                                                            >
                                                                {
                                                                    labels
                                                                        .recurrence[
                                                                        value
                                                                    ]
                                                                }
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            recurrence && (
                                                <span className="truncate text-sm">
                                                    {labels.repeats[recurrence]}
                                                </span>
                                            )
                                        )}
                                        <SavingMark
                                            active={
                                                savingField === 'recurrence'
                                            }
                                        />
                                    </div>
                                    {recurrence && followUpDate && (
                                        <p className="mt-1 text-xs break-words text-muted-foreground">
                                            {t(
                                                'Follows up the item completed on :date',
                                                {
                                                    date: formatActionDay(
                                                        followUpDate,
                                                        locale,
                                                    ),
                                                },
                                            )}
                                        </p>
                                    )}
                                </SheetProperty>
                            )}
                        {createdBy !== undefined && (
                            <SheetProperty
                                label={t('Created by')}
                                icon={<UserPen />}
                            >
                                <span className="flex min-w-0 items-center gap-2 text-sm">
                                    <PersonAvatar
                                        decorative
                                        size="sm"
                                        name={
                                            createdBy?.name ??
                                            t('Former member')
                                        }
                                        src={createdBy?.avatarUrl}
                                    />
                                    <span className="truncate">
                                        {createdBy?.name ?? t('Former member')}
                                    </span>
                                </span>
                            </SheetProperty>
                        )}
                        {themeName && (
                            <SheetProperty label={t('Theme')} icon={<Tag />}>
                                <span className="block truncate text-sm">
                                    {themeName}
                                </span>
                            </SheetProperty>
                        )}
                        {source && (
                            <SheetProperty
                                label={t('Retrospective')}
                                icon={<StickyNote />}
                            >
                                {source.url ? (
                                    <Link
                                        href={source.url}
                                        className="block truncate rounded-xs text-sm text-skrum-primary-text underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                                    >
                                        {source.label}
                                    </Link>
                                ) : (
                                    <span className="block truncate text-sm">
                                        {source.label}
                                    </span>
                                )}
                            </SheetProperty>
                        )}
                        {watchers && watchers.length > 0 && (
                            <SheetProperty
                                label={t('Watchers')}
                                icon={<Users />}
                            >
                                <ul className="flex min-w-0 flex-wrap items-center gap-1">
                                    {watchers.map((watcher) => (
                                        <li
                                            key={actionOwnerValue(watcher)}
                                            className="flex"
                                        >
                                            <PersonAvatar
                                                size="sm"
                                                name={watcher.name}
                                                kind={watcher.kind}
                                                presence={watcher.presence}
                                                src={watcher.avatarUrl}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </SheetProperty>
                        )}
                    </SheetProperties>
                    {((subtasks && subtasks.length > 0) || children) && (
                        <Section
                            title={t('Sub-tasks')}
                            aside={
                                subtasks &&
                                subtasks.length > 0 && (
                                    <span
                                        data-slot="action-sheet-subtasks"
                                        className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
                                    >
                                        <span aria-hidden>
                                            {doneSubtasks}/{subtasks.length}
                                        </span>
                                        <span className="sr-only">
                                            {t(
                                                ':done of :total sub-tasks done',
                                                {
                                                    done: doneSubtasks,
                                                    total: subtasks.length,
                                                },
                                            )}
                                        </span>
                                    </span>
                                )
                            }
                        >
                            {children}
                        </Section>
                    )}
                    {links && links.length > 0 && (
                        <Section title={t('External links')}>
                            <ul className="flex min-w-0 flex-col gap-2">
                                {links.map((link) => (
                                    <LinkRow
                                        key={link.id}
                                        link={link}
                                        locale={locale}
                                        disabled={readOnly || deleted}
                                        onRetrySync={
                                            readOnly ? undefined : onRetrySync
                                        }
                                    />
                                ))}
                            </ul>
                        </Section>
                    )}
                    {originCard && (
                        <Section title={t('Origin card')}>{originCard}</Section>
                    )}
                    {(comments || commentCount !== undefined) && (
                        <Section
                            title={t('Comments')}
                            aside={
                                commentCount !== undefined && (
                                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                                        {commentCount}
                                    </span>
                                )
                            }
                        >
                            {comments}
                        </Section>
                    )}
                    {history && (
                        <Section title={t('History')}>{history}</Section>
                    )}
                </SheetBody>
                {hasFooter && (
                    <SheetFooter className="flex-wrap">
                        {onStatusChange && (
                            <Button
                                type="button"
                                className="min-w-0"
                                disabled={!completes}
                                onClick={() => onStatusChange(footerStatus)}
                            >
                                <span className="truncate">
                                    {labels.statusAction[footerStatus]}
                                </span>
                            </Button>
                        )}
                        {actions}
                        {onDelete && (
                            <Button
                                type="button"
                                variant="outline"
                                className="ml-auto min-w-0 text-skrum-destructive-text"
                                disabled={deleted}
                                aria-label={t('Delete action item')}
                                onClick={onDelete}
                            >
                                <Trash2 aria-hidden />
                                <span className="truncate">{t('Delete')}</span>
                            </Button>
                        )}
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    );
}
