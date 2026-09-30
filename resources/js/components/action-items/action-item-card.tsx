import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { assigneePayload, assigneeValue } from '@/lib/action-items/assignees';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import {
    canCompleteActionItem,
    canManageActionItem,
    type ActionItemViewer,
} from '@/lib/action-items/permissions';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import { ActionItemComments } from './action-item-comments';
import { AssigneeSelect, type AssigneeGroup } from './assignee-select';
import { DueDateChip } from './due-date-chip';
import { PriorityIcon, PrioritySelect } from './priority-select';

export type RunMutation = <T>(mutation: Promise<T>) => Promise<T | undefined>;

type Props = {
    item: ActionItem;
    endpoints: ActionItemEndpoints;
    viewer: ActionItemViewer;
    assigneeGroups: AssigneeGroup[];
    run: RunMutation;
    onSaved: (item: ActionItem) => void;
    onRemoved: (actionItemId: string) => void;
    onCommentCount: (actionItemId: string, count: number) => void;
    editable: boolean;
    showAnonymousNotice?: boolean;
    meta?: ReactNode;
    defaultExpanded?: boolean;
    children?: ReactNode;
};

export function ActionItemCard({
    item,
    endpoints,
    viewer,
    assigneeGroups,
    run,
    onSaved,
    onRemoved,
    onCommentCount,
    editable,
    showAnonymousNotice,
    meta,
    defaultExpanded = false,
    children,
}: Props) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(item.content);
    const [dueDraft, setDueDraft] = useState(item.dueOn ?? '');
    const [knownDueOn, setKnownDueOn] = useState(item.dueOn);
    const [commentsOpen, setCommentsOpen] = useState(defaultExpanded);
    const manages = editable && canManageActionItem(item, viewer);
    const completes = editable && canCompleteActionItem(item, viewer);
    const completed = item.status === 'completed';

    if (knownDueOn !== item.dueOn) {
        setKnownDueOn(item.dueOn);
        setDueDraft(item.dueOn ?? '');
    }

    const patch = async (data: Record<string, unknown>) => {
        if (busy) {
            return;
        }

        setBusy(true);
        const response = await run(
            retroRequest<{ actionItem: ActionItem }>(
                endpoints.update(item.id),
                data,
            ),
        );
        setBusy(false);

        if (response) {
            onSaved(response.actionItem);
        }
    };

    const remove = async () => {
        if (busy) {
            return;
        }

        setBusy(true);
        const result = await run(retroRequest(endpoints.destroy(item.id)));
        setBusy(false);

        if (result !== undefined) {
            onRemoved(item.id);
        }
    };

    const saveContent = () => {
        const trimmed = draft.trim();

        setEditing(false);

        if (trimmed === '' || trimmed === item.content) {
            return;
        }

        void patch({ content: trimmed });
    };

    const saveDueDate = () => {
        if (dueDraft === (item.dueOn ?? '')) {
            return;
        }

        void patch({ due_on: dueDraft === '' ? null : dueDraft });
    };

    return (
        <li
            id={`action-item-${item.id}`}
            className="space-y-2 rounded-md border bg-card p-2"
        >
            <div className="flex items-start gap-2">
                <Checkbox
                    className="mt-1"
                    checked={completed}
                    disabled={busy || !completes}
                    aria-label={completed ? t('Reopen') : t('Mark as done')}
                    onCheckedChange={(checked) =>
                        void patch({
                            status: checked === true ? 'completed' : 'open',
                        })
                    }
                />
                <div className="min-w-0 flex-1 space-y-1">
                    {editing ? (
                        <form
                            className="flex gap-1"
                            onSubmit={(event) => {
                                event.preventDefault();
                                saveContent();
                            }}
                        >
                            <Input
                                autoFocus
                                value={draft}
                                maxLength={500}
                                className="h-7"
                                aria-label={t('Edit action item')}
                                onChange={(event) =>
                                    setDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        setEditing(false);
                                    }
                                }}
                            />
                            <Button type="submit" size="sm" disabled={busy}>
                                {t('Save')}
                            </Button>
                        </form>
                    ) : (
                        <p
                            className={`text-sm break-words ${completed ? 'text-muted-foreground line-through' : ''}`}
                        >
                            {item.content}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <PriorityIcon priority={item.priority} />
                        <DueDateChip item={item} />
                        <span className="flex items-center gap-1">
                            <Avatar className="size-4">
                                {item.createdBy && (
                                    <AvatarImage
                                        src={item.createdBy.avatarUrl}
                                        alt=""
                                    />
                                )}
                                <AvatarFallback />
                            </Avatar>
                            {item.createdBy?.name ?? t('Former member')}
                        </span>
                        {item.themeName && (
                            <Badge variant="outline" className="font-normal">
                                {t('Theme: :name', { name: item.themeName })}
                            </Badge>
                        )}
                        {meta}
                    </div>
                </div>
                {manages && !editing && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0"
                        aria-label={t('Edit action item')}
                        onClick={() => {
                            setDraft(item.content);
                            setEditing(true);
                        }}
                    >
                        <Pencil className="size-4" />
                    </Button>
                )}
                {manages && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0"
                        disabled={busy}
                        aria-label={t('Delete action item')}
                        onClick={() => void remove()}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                )}
            </div>
            {children}
            <div className="grid grid-cols-2 gap-2">
                <PrioritySelect
                    value={item.priority}
                    disabled={busy || !manages}
                    onChange={(priority) => void patch({ priority })}
                />
                <Input
                    type="date"
                    className="h-8"
                    value={dueDraft}
                    min="2000-01-01"
                    max="2100-12-31"
                    disabled={busy || !manages}
                    aria-label={t('Due date')}
                    onChange={(event) => setDueDraft(event.target.value)}
                    onBlur={saveDueDate}
                />
            </div>
            <AssigneeSelect
                value={assigneeValue(item.assignee)}
                current={item.assignee}
                groups={assigneeGroups}
                disabled={busy || !manages}
                onChange={(value) => void patch(assigneePayload(value))}
            />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2"
                aria-expanded={commentsOpen}
                onClick={() => setCommentsOpen(!commentsOpen)}
            >
                <MessageSquare className="size-4" />
                {item.commentCount === 1
                    ? t('1 comment')
                    : t(':count comments', { count: item.commentCount })}
            </Button>
            {commentsOpen && (
                <ActionItemComments
                    item={item}
                    endpoints={endpoints}
                    viewer={viewer}
                    canWrite={editable}
                    showAnonymousNotice={showAnonymousNotice}
                    run={run}
                    onCountChange={(count) => onCommentCount(item.id, count)}
                />
            )}
        </li>
    );
}
