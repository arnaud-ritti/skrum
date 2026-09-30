import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type {
    ActionItemEndpoints,
    EndpointRoute,
} from '@/lib/action-items/endpoints';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import type { RunMutation } from './action-item-card';

const MaxSubtasks = 20;

type Props = {
    item: ActionItem;
    endpoints: ActionItemEndpoints;
    run: RunMutation;
    canManage: boolean;
    canCheck: boolean;
    onSaved: (item: ActionItem) => void;
};

export function SubtaskChecklist({
    item,
    endpoints,
    run,
    canManage,
    canCheck,
    onSaved,
}: Props) {
    const { t } = useTrans();
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState<{
        id: string;
        content: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const subtasks = item.subtasks;

    const send = async (
        route: EndpointRoute,
        data?: Record<string, unknown>,
    ): Promise<boolean> => {
        if (busy) {
            return false;
        }

        setBusy(true);

        try {
            const response = await run(
                retroRequest<{ actionItem: ActionItem }>(route, data),
            );

            if (!response) {
                return false;
            }

            onSaved(response.actionItem);

            return true;
        } finally {
            setBusy(false);
        }
    };

    const add = async () => {
        const content = draft.trim();

        if (content === '') {
            return;
        }

        if (await send(endpoints.addSubtask(item.id), { content })) {
            setDraft('');
        }
    };

    const rename = async () => {
        const content = editing?.content.trim() ?? '';

        if (editing === null || content === '') {
            return;
        }

        if (await send(endpoints.updateSubtask(editing.id), { content })) {
            setEditing(null);
        }
    };

    if (subtasks.length === 0 && !canManage) {
        return null;
    }

    return (
        <div className="space-y-1 pl-6">
            <ul className="space-y-1" aria-label={t('Sub-tasks')}>
                {subtasks.map((subtask, index) => (
                    <li
                        key={subtask.id}
                        className="flex items-center gap-1 text-sm"
                    >
                        <Checkbox
                            checked={subtask.isCompleted}
                            disabled={busy || !canCheck}
                            aria-label={subtask.content}
                            onCheckedChange={(checked) =>
                                void send(endpoints.updateSubtask(subtask.id), {
                                    status:
                                        checked === true ? 'completed' : 'open',
                                })
                            }
                        />
                        {editing?.id === subtask.id ? (
                            <form
                                className="flex flex-1 gap-1"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void rename();
                                }}
                            >
                                <Input
                                    autoFocus
                                    value={editing.content}
                                    maxLength={200}
                                    className="h-7"
                                    aria-label={t('Edit sub-task')}
                                    onChange={(event) =>
                                        setEditing({
                                            id: subtask.id,
                                            content: event.target.value,
                                        })
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') {
                                            event.preventDefault();
                                            setEditing(null);
                                        }
                                    }}
                                />
                                <Button type="submit" size="sm" disabled={busy}>
                                    {t('Save')}
                                </Button>
                            </form>
                        ) : (
                            <span
                                className={`min-w-0 flex-1 break-words ${subtask.isCompleted ? 'text-muted-foreground line-through' : ''}`}
                            >
                                {subtask.content}
                            </span>
                        )}
                        {canManage && editing?.id !== subtask.id && (
                            <>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    disabled={busy || index === 0}
                                    aria-label={t('Move up')}
                                    onClick={() =>
                                        void send(
                                            endpoints.updateSubtask(subtask.id),
                                            { position: index - 1 },
                                        )
                                    }
                                >
                                    <ArrowUp className="size-3" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    disabled={
                                        busy || index === subtasks.length - 1
                                    }
                                    aria-label={t('Move down')}
                                    onClick={() =>
                                        void send(
                                            endpoints.updateSubtask(subtask.id),
                                            { position: index + 1 },
                                        )
                                    }
                                >
                                    <ArrowDown className="size-3" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    aria-label={t('Edit sub-task')}
                                    onClick={() =>
                                        setEditing({
                                            id: subtask.id,
                                            content: subtask.content,
                                        })
                                    }
                                >
                                    <Pencil className="size-3" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    disabled={busy}
                                    aria-label={t('Delete sub-task')}
                                    onClick={() =>
                                        void send(
                                            endpoints.destroySubtask(
                                                subtask.id,
                                            ),
                                        )
                                    }
                                >
                                    <Trash2 className="size-3" />
                                </Button>
                            </>
                        )}
                    </li>
                ))}
            </ul>
            {canManage && subtasks.length < MaxSubtasks && (
                <form
                    className="flex gap-1"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void add();
                    }}
                >
                    <Input
                        value={draft}
                        maxLength={200}
                        className="h-7"
                        placeholder={t('Add a sub-task')}
                        aria-label={t('Add a sub-task')}
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={busy || draft.trim() === ''}
                    >
                        {t('Add')}
                    </Button>
                </form>
            )}
        </div>
    );
}
