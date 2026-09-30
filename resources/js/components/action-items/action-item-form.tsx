import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { assigneePayload, Unassigned } from '@/lib/action-items/assignees';
import type { ActionItemPriority } from '@/lib/retro/types';
import { AnonymousNotice } from './anonymous-notice';
import { AssigneeSelect, type AssigneeGroup } from './assignee-select';
import { PrioritySelect } from './priority-select';

export type ActionItemDraft = {
    content: string;
    priority: ActionItemPriority;
    dueOn: string;
    assignee: string;
    /** Fields contributed through `extraFields`, sent as they are. */
    extra: Record<string, unknown>;
};

export function emptyActionItemDraft(): ActionItemDraft {
    return {
        content: '',
        priority: 'medium',
        dueOn: '',
        assignee: Unassigned,
        extra: {},
    };
}

export function actionItemPayload(
    draft: ActionItemDraft,
): Record<string, unknown> {
    return {
        content: draft.content.trim(),
        priority: draft.priority,
        due_on: draft.dueOn === '' ? null : draft.dueOn,
        ...assigneePayload(draft.assignee),
        ...draft.extra,
    };
}

type Props = {
    assigneeGroups: AssigneeGroup[];
    disabled?: boolean;
    showAnonymousNotice?: boolean;
    submitLabel: string;
    extraFields?: (
        draft: ActionItemDraft,
        update: (changes: Partial<ActionItemDraft>) => void,
    ) => ReactNode;
    onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
};

export function ActionItemForm({
    assigneeGroups,
    disabled = false,
    showAnonymousNotice,
    submitLabel,
    extraFields,
    onSubmit,
}: Props) {
    const { t } = useTrans();
    const [draft, setDraft] = useState<ActionItemDraft>(emptyActionItemDraft);
    const [sending, setSending] = useState(false);
    const update = (changes: Partial<ActionItemDraft>) =>
        setDraft((current) => ({ ...current, ...changes }));

    const submit = async () => {
        if (sending || draft.content.trim() === '') {
            return;
        }

        setSending(true);
        const created = await onSubmit(actionItemPayload(draft));
        setSending(false);

        if (created) {
            setDraft(emptyActionItemDraft());
        }
    };

    return (
        <form
            className="space-y-2"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            {showAnonymousNotice && <AnonymousNotice />}
            <Input
                value={draft.content}
                maxLength={500}
                disabled={disabled}
                placeholder={t('Add an action item…')}
                aria-label={t('Add an action item…')}
                onChange={(event) => update({ content: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
                <PrioritySelect
                    value={draft.priority}
                    disabled={disabled || sending}
                    onChange={(priority) => update({ priority })}
                />
                <Input
                    type="date"
                    className="h-8"
                    value={draft.dueOn}
                    min="2000-01-01"
                    max="2100-12-31"
                    disabled={disabled || sending}
                    aria-label={t('Due date')}
                    onChange={(event) => update({ dueOn: event.target.value })}
                />
            </div>
            <AssigneeSelect
                value={draft.assignee}
                groups={assigneeGroups}
                disabled={disabled || sending}
                onChange={(assignee) => update({ assignee })}
            />
            {extraFields?.(draft, update)}
            <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={disabled || sending || draft.content.trim() === ''}
            >
                {submitLabel}
            </Button>
        </form>
    );
}
