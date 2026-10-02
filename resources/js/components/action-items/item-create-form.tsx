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
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { RadioGroup, RadioGroupCardItem } from '@/components/ui/radio-group';
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
import { cn } from '@/lib/utils';
import type { ExportSource } from '@/types/integrations';

const TitleMaxLength = 500;
const None = 'none';
const Priorities: ActionItemPriority[] = ['high', 'medium', 'low'];
/** The order of the segmented control of the drawer, as the mockup has it. */
const AscendingPriorities: ActionItemPriority[] = ['low', 'medium', 'high'];

const chipClass =
    'inline-flex h-10 w-auto shrink-0 flex-row items-center gap-1.5 rounded-full border-input py-0 pr-3.5 pl-1 text-sm font-semibold shadow-none data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background data-[state=checked]:ring-0 data-[state=checked]:hover:bg-foreground';

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
    /**
     * `stacked` is the form of a phone drawer: one field per line with its
     * label, the assignee as avatar chips, the priority as three segments.
     */
    layout?: 'inline' | 'stacked';
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
    layout = 'inline',
}: Props): ReactElement {
    const { t } = useTrans();
    const labels = useActionItemLabels();
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [sending, setSending] = useState(false);
    const titleField = useRef<HTMLInputElement>(null);
    const locked = disabled || sending;
    const stacked = layout === 'stacked';
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

    const dueDateField = (
        <Input
            type="date"
            className={stacked ? 'h-11' : 'h-8'}
            value={draft.dueDate}
            min="2000-01-01"
            max="2100-12-31"
            disabled={locked}
            aria-label={t('Due date')}
            onChange={(event) =>
                update({
                    dueDate: event.target.value,
                    ...(event.target.value === '' ? { recurrence: null } : {}),
                })
            }
        />
    );

    const recurrenceField = (
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
                size={stacked ? 'default' : 'sm'}
                className={cn('w-full', stacked && 'data-[size=default]:h-11')}
                aria-label={t('Repeat')}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={None}>{t('Does not repeat')}</SelectItem>
                {ActionItemRecurrences.map((recurrence) => (
                    <SelectItem key={recurrence} value={recurrence}>
                        {labels.recurrence[recurrence]}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    const fields = stacked ? (
        <>
            <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-sm font-medium" aria-hidden>
                    {t('Assignee')}
                </span>
                <RadioGroup
                    aria-label={t('Assignee')}
                    orientation="horizontal"
                    value={draft.owner}
                    disabled={locked}
                    onValueChange={(owner) => update({ owner })}
                    data-slot="assignee-chips"
                    className="relative -mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 py-1"
                >
                    <RadioGroupCardItem
                        value={None}
                        className={cn(chipClass, 'pl-3.5')}
                    >
                        {t('Unassigned')}
                    </RadioGroupCardItem>
                    {members.map((member) => (
                        <RadioGroupCardItem
                            key={actionOwnerValue(member)}
                            value={actionOwnerValue(member)}
                            className={chipClass}
                        >
                            <PersonAvatar
                                decorative
                                size="md"
                                name={member.name}
                                kind={member.kind}
                                src={member.avatarUrl}
                            />
                            <span className="max-w-40 truncate">
                                {labels.ownerName(member)}
                            </span>
                        </RadioGroupCardItem>
                    ))}
                </RadioGroup>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-sm font-medium" aria-hidden>
                    {t('Priority')}
                </span>
                <RadioGroup
                    aria-label={t('Priority')}
                    orientation="horizontal"
                    value={draft.priority}
                    disabled={locked}
                    onValueChange={(priority) => update({ priority })}
                    data-slot="priority-segments"
                    className="grid min-w-0 grid-cols-3 gap-2"
                >
                    {AscendingPriorities.map((priority) => (
                        <RadioGroupCardItem
                            key={priority}
                            value={priority}
                            className="h-11 flex-row items-center justify-center gap-1.5 border-input px-2 py-0 text-sm font-semibold shadow-none data-[state=checked]:text-skrum-primary-text data-[state=checked]:ring-1"
                        >
                            <span className="truncate">
                                {labels.priority[priority]}
                            </span>
                        </RadioGroupCardItem>
                    ))}
                </RadioGroup>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-sm font-medium" aria-hidden>
                        {t('Due date')}
                    </span>
                    {dueDateField}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-sm font-medium" aria-hidden>
                        {t('Repeat')}
                    </span>
                    {recurrenceField}
                </div>
            </div>
        </>
    ) : (
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
            {dueDateField}
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
            {recurrenceField}
        </div>
    );

    return (
        <form
            data-slot="item-create-form"
            data-layout={layout}
            aria-label={t('New action item')}
            className={cn(
                '@container/create flex min-w-0 flex-col gap-2',
                stacked ? 'gap-4' : 'rounded-lg bg-muted p-3',
            )}
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
                className={stacked ? 'h-11 text-base' : undefined}
                onChange={(event) => update({ title: event.target.value })}
            />
            {fields}
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
                {!stacked && (
                    <span className="mr-auto inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <Kbd className="bg-card">
                            <span aria-hidden>↵</span>
                            <span className="sr-only">{t('Enter')}</span>
                        </Kbd>
                        <span className="truncate">{t('to create')}</span>
                    </span>
                )}
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
                    size={stacked ? 'lg' : 'sm'}
                    className={cn('max-w-full min-w-0', stacked && 'w-full')}
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
