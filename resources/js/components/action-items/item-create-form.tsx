import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { NewActionItem } from '@/components/action-items/action-item-adapters';
import { AnonymousNote } from '@/components/action-items/item-parts';
import {
    actionOwnerValue,
    ActionItemRecurrences,
    ActionOwnerOptions,
    ActionPriorityMark,
    useActionItemLabels,
} from '@/components/skrum/action-item';
import type { ActionItemOwner } from '@/components/skrum/action-item';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type {
    ActionItem,
    ActionItemPriority,
    ActionItemRecurrence,
} from '@/lib/retro/types';
import type { ExportSource } from '@/types/integrations';

const TitleMaxLength = 500;
const None = 'none';
const Priorities: ActionItemPriority[] = ['high', 'medium', 'low'];

type Draft = {
    title: string;
    priority: ActionItemPriority;
    dueDate: string;
    recurrence: ActionItemRecurrence | null;
    owner: string;
    ticket: string;
};

const emptyDraft: Draft = {
    title: '',
    priority: 'medium',
    dueDate: '',
    recurrence: null,
    owner: None,
    ticket: None,
};

type Props = {
    members: ActionItemOwner[];
    /**
     * Resolves to the created item, to `true` when the host keeps the item
     * for itself, or to `false` when nothing was created. The ticket step
     * needs the item.
     */
    onCreate: (values: NewActionItem) => Promise<ActionItem | boolean>;
    ids?: { title?: string };
    exportSources?: ExportSource[];
    onCreatedWithTicket?: (item: ActionItem, source: ExportSource) => void;
    disabled?: boolean;
    showAnonymousNotice?: boolean;
    /** What the item is attached to, such as the topic in focus. */
    linkedTo?: ReactNode;
    onCancel?: () => void;
};

export function ItemCreateForm({
    members,
    onCreate,
    ids,
    exportSources = [],
    onCreatedWithTicket,
    disabled = false,
    showAnonymousNotice = false,
    linkedTo,
    onCancel,
}: Props): ReactElement {
    const { t } = useTrans();
    const labels = useActionItemLabels();
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [sending, setSending] = useState(false);
    const titleField = useRef<HTMLInputElement>(null);
    const locked = disabled || sending;
    const offersTicket =
        exportSources.length > 0 && onCreatedWithTicket !== undefined;
    const update = (changes: Partial<Draft>): void =>
        setDraft((current) => ({ ...current, ...changes }));

    const submit = async (): Promise<void> => {
        const title = draft.title.trim();

        if (locked || title === '') {
            return;
        }

        const ticketSource = offersTicket
            ? exportSources.find((source) => source.source === draft.ticket)
            : undefined;

        setSending(true);

        try {
            const created = await onCreate({
                title,
                priority: draft.priority,
                dueDate: draft.dueDate === '' ? null : draft.dueDate,
                recurrence: draft.dueDate === '' ? null : draft.recurrence,
                owner:
                    members.find(
                        (member) => actionOwnerValue(member) === draft.owner,
                    ) ?? null,
            });

            if (created === false) {
                return;
            }

            setDraft(emptyDraft);
            titleField.current?.focus();

            if (ticketSource && typeof created === 'object') {
                onCreatedWithTicket?.(created, ticketSource);
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <form
            data-slot="item-create-form"
            aria-label={t('New action item')}
            className="@container/create flex min-w-0 flex-col gap-2 rounded-lg bg-muted p-3"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            {linkedTo && (
                <div className="flex min-w-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                    {linkedTo}
                </div>
            )}
            {showAnonymousNotice && <AnonymousNote />}
            <Input
                ref={titleField}
                id={ids?.title}
                value={draft.title}
                maxLength={TitleMaxLength}
                disabled={disabled}
                placeholder={t('Add an action item…')}
                aria-label={t('Add an action item…')}
                onChange={(event) => update({ title: event.target.value })}
            />
            <div className="grid min-w-0 grid-cols-1 gap-2 @2xs/create:grid-cols-2 @2xl/create:grid-cols-4">
                <Select
                    value={draft.owner}
                    disabled={locked}
                    onValueChange={(owner) => update({ owner })}
                >
                    <SelectTrigger
                        size="sm"
                        className="w-full"
                        aria-label={t('Assignee')}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={None}>{t('Unassigned')}</SelectItem>
                        <ActionOwnerOptions members={members} withAvatar />
                    </SelectContent>
                </Select>
                <Input
                    type="date"
                    className="h-8"
                    value={draft.dueDate}
                    min="2000-01-01"
                    max="2100-12-31"
                    disabled={locked}
                    aria-label={t('Due date')}
                    onChange={(event) =>
                        update({
                            dueDate: event.target.value,
                            ...(event.target.value === ''
                                ? { recurrence: null }
                                : {}),
                        })
                    }
                />
                <Select
                    value={draft.priority}
                    disabled={locked}
                    onValueChange={(priority) =>
                        update({ priority: priority as ActionItemPriority })
                    }
                >
                    <SelectTrigger
                        size="sm"
                        className="w-full"
                        aria-label={t('Priority')}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Priorities.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                                <ActionPriorityMark
                                    priority={priority}
                                    label={labels.priority[priority]}
                                />
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={draft.recurrence ?? None}
                    disabled={locked || draft.dueDate === ''}
                    onValueChange={(recurrence) =>
                        update({
                            recurrence:
                                recurrence === None
                                    ? null
                                    : (recurrence as ActionItemRecurrence),
                        })
                    }
                >
                    <SelectTrigger
                        size="sm"
                        className="w-full"
                        aria-label={t('Repeat')}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={None}>
                            {t('Does not repeat')}
                        </SelectItem>
                        {ActionItemRecurrences.map((recurrence) => (
                            <SelectItem key={recurrence} value={recurrence}>
                                {labels.recurrence[recurrence]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {offersTicket && exportSources.length === 1 && (
                <Checkbox
                    checked={draft.ticket === exportSources[0].source}
                    disabled={locked}
                    label={t('Create the ticket in :provider', {
                        provider: exportSources[0].label,
                    })}
                    onCheckedChange={(checked) =>
                        update({
                            ticket:
                                checked === true
                                    ? exportSources[0].source
                                    : None,
                        })
                    }
                />
            )}
            {offersTicket && exportSources.length > 1 && (
                <Select
                    value={draft.ticket}
                    disabled={locked}
                    onValueChange={(ticket) => update({ ticket })}
                >
                    <SelectTrigger
                        size="sm"
                        className="w-full"
                        aria-label={t('Ticket')}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={None}>{t('No ticket')}</SelectItem>
                        {exportSources.map((source) => (
                            <SelectItem
                                key={source.source}
                                value={source.source}
                            >
                                {t('Create the ticket in :provider', {
                                    provider: source.label,
                                })}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <span className="mr-auto inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <Kbd className="bg-card">
                        <span aria-hidden>↵</span>
                        <span className="sr-only">{t('Enter')}</span>
                    </Kbd>
                    <span className="truncate">{t('to create')}</span>
                </span>
                {onCancel && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="max-w-full min-w-0"
                        onClick={onCancel}
                    >
                        <span className="truncate">{t('Cancel')}</span>
                    </Button>
                )}
                <LoadingButton
                    type="submit"
                    size="sm"
                    className="max-w-full min-w-0"
                    loading={sending}
                    disabled={disabled || draft.title.trim() === ''}
                >
                    <Plus aria-hidden />
                    <span className="truncate">{t('Create')}</span>
                </LoadingButton>
            </div>
        </form>
    );
}
