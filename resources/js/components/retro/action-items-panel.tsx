import { Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import ActionItemsController from '@/actions/App/Http/Controllers/Retros/ActionItemsController';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem, BoardParticipant } from '@/lib/retro/types';
import { useBoard } from './board-context';

const Unassigned = 'none';

function AssigneeSelect({
    value,
    participants,
    disabled,
    onChange,
}: {
    value: string | null;
    participants: BoardParticipant[];
    disabled?: boolean;
    onChange: (participantId: string | null) => void;
}) {
    const { t } = useTrans();

    return (
        <Select
            value={value ?? Unassigned}
            disabled={disabled}
            onValueChange={(next) =>
                onChange(next === Unassigned ? null : next)
            }
        >
            <SelectTrigger
                size="sm"
                className="w-full"
                aria-label={t('Assignee')}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={Unassigned}>{t('Unassigned')}</SelectItem>
                {participants.map((participant) => (
                    <SelectItem key={participant.id} value={participant.id}>
                        {participant.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function ActionItemRow({ item }: { item: ActionItem }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(item.content);
    const [busy, setBusy] = useState(false);
    const settled = useRef(false);
    const retroId = ctx.board.retro.id;

    const patch = async (
        data: Partial<{
            content: string;
            assignee_participant_id: string | null;
            is_done: boolean;
        }>,
    ) => {
        if (busy) {
            return;
        }

        setBusy(true);
        const response = await ctx.run(
            retroRequest<{ actionItem: ActionItem }>(
                ActionItemsController.update({
                    retro: retroId,
                    actionItem: item.id,
                }),
                data,
            ),
        );
        setBusy(false);

        if (response) {
            ctx.dispatch({
                type: 'actionItem.upsert',
                actionItem: response.actionItem,
            });
        }
    };

    const remove = async () => {
        if (busy) {
            return;
        }

        setBusy(true);
        const result = await ctx.run(
            retroRequest(
                ActionItemsController.destroy({
                    retro: retroId,
                    actionItem: item.id,
                }),
            ),
        );
        setBusy(false);

        if (result !== undefined) {
            ctx.dispatch({ type: 'actionItem.remove', actionItemId: item.id });
        }
    };

    const startEditing = () => {
        settled.current = false;
        setDraft(item.content);
        setEditing(true);
    };

    const finishEditing = (save: boolean) => {
        if (settled.current) {
            return;
        }

        settled.current = true;
        setEditing(false);

        const trimmed = draft.trim();

        if (save && trimmed !== '' && trimmed !== item.content) {
            void patch({ content: trimmed });
        }
    };

    return (
        <li className="space-y-2 rounded-md border p-2">
            <div className="flex items-start gap-2">
                <Checkbox
                    className="mt-1"
                    checked={item.isDone}
                    disabled={busy}
                    aria-label={t('Mark as done')}
                    onCheckedChange={(checked) =>
                        void patch({ is_done: checked === true })
                    }
                />
                {editing ? (
                    <Input
                        autoFocus
                        value={draft}
                        maxLength={500}
                        className="h-7"
                        aria-label={t('Edit action item')}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => finishEditing(true)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                finishEditing(true);
                            }

                            if (event.key === 'Escape') {
                                event.preventDefault();
                                finishEditing(false);
                            }
                        }}
                    />
                ) : (
                    <button
                        type="button"
                        title={t('Edit action item')}
                        className={`min-w-0 flex-1 text-left text-sm break-words ${item.isDone ? 'text-muted-foreground line-through' : ''}`}
                        onClick={startEditing}
                    >
                        {item.content}
                    </button>
                )}
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
            </div>
            <AssigneeSelect
                value={item.assignee?.id ?? null}
                participants={ctx.board.participants}
                disabled={busy}
                onChange={(participantId) =>
                    void patch({ assignee_participant_id: participantId })
                }
            />
        </li>
    );
}

export function ActionItemsPanel() {
    const ctx = useBoard();
    const { t } = useTrans();
    const [content, setContent] = useState('');
    const [assigneeId, setAssigneeId] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const items = ctx.board.actionItems;

    const add = async () => {
        const trimmed = content.trim();

        if (trimmed === '' || sending) {
            return;
        }

        setSending(true);
        const response = await ctx.run(
            retroRequest<{ actionItem: ActionItem }>(
                ActionItemsController.store(ctx.board.retro.id),
                {
                    content: trimmed,
                    assignee_participant_id: assigneeId,
                },
            ),
        );
        setSending(false);

        if (response) {
            ctx.dispatch({
                type: 'actionItem.upsert',
                actionItem: response.actionItem,
            });
            setContent('');
            setAssigneeId(null);
        }
    };

    return (
        <aside className="w-full shrink-0 space-y-3 p-4 lg:sticky lg:top-4 lg:max-h-dvh lg:w-80 lg:self-start lg:overflow-y-auto">
            <h2 className="text-sm font-semibold">{t('Action items')}</h2>
            <form
                className="space-y-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    void add();
                }}
            >
                <Input
                    value={content}
                    maxLength={500}
                    placeholder={t('Add an action item…')}
                    aria-label={t('Add an action item…')}
                    onChange={(event) => setContent(event.target.value)}
                />
                <AssigneeSelect
                    value={assigneeId}
                    participants={ctx.board.participants}
                    onChange={setAssigneeId}
                />
                <Button
                    type="submit"
                    size="sm"
                    className="w-full"
                    disabled={sending || content.trim() === ''}
                >
                    {t('Add')}
                </Button>
            </form>
            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No action items yet.')}
                </p>
            ) : (
                <ul className="space-y-2">
                    {items.map((item) => (
                        <ActionItemRow key={item.id} item={item} />
                    ))}
                </ul>
            )}
        </aside>
    );
}
