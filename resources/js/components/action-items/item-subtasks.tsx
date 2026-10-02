import {
    ArrowDown,
    ArrowUp,
    Check,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useInlineEscape } from '@/components/action-items/item-parts';
import { useActionItemMutationsValue } from '@/components/action-items/use-action-item-mutations';
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
import { cn } from '@/lib/utils';

export const MaxSubtasks = 20;

const SubtaskMaxLength = 200;

type Props = {
    item: ActionItem;
    endpoints: ActionItemEndpoints;
    canManage: boolean;
    canComplete: boolean;
};

export function ItemSubtasks({
    item,
    endpoints,
    canManage,
    canComplete,
}: Props): ReactElement | null {
    const { t } = useTrans();
    const { run, onSaved } = useActionItemMutationsValue();
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState<{
        id: string;
        content: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const editor = useRef<HTMLFormElement>(null);
    const subtasks = item.subtasks;

    useInlineEscape(editor, editing !== null, () => setEditing(null));

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
                data === undefined
                    ? retroRequest<{ actionItem: ActionItem }>(route)
                    : retroRequest<{ actionItem: ActionItem }>(route, data),
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

    const add = async (): Promise<void> => {
        const content = draft.trim();

        if (content === '') {
            return;
        }

        if (await send(endpoints.addSubtask(item.id), { content })) {
            setDraft('');
        }
    };

    const rename = async (): Promise<void> => {
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
        <div data-slot="item-subtasks" className="flex min-w-0 flex-col gap-2">
            {subtasks.length > 0 && (
                <ul
                    aria-label={t('Sub-tasks')}
                    className="flex min-w-0 flex-col gap-1"
                >
                    {subtasks.map((subtask, index) => (
                        <li
                            key={subtask.id}
                            className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                        >
                            <Checkbox
                                checked={subtask.isCompleted}
                                disabled={busy || !canComplete}
                                aria-label={subtask.content}
                                onCheckedChange={(checked) =>
                                    void send(
                                        endpoints.updateSubtask(subtask.id),
                                        {
                                            status:
                                                checked === true
                                                    ? 'completed'
                                                    : 'open',
                                        },
                                    )
                                }
                            />
                            {editing?.id === subtask.id ? (
                                <form
                                    ref={editor}
                                    className="flex min-w-0 flex-1 basis-40 flex-wrap items-center gap-1"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        void rename();
                                    }}
                                >
                                    <Input
                                        autoFocus
                                        value={editing.content}
                                        maxLength={SubtaskMaxLength}
                                        className="h-8 min-w-0 flex-1 basis-32"
                                        aria-label={t('Edit sub-task')}
                                        onChange={(event) =>
                                            setEditing({
                                                id: subtask.id,
                                                content: event.target.value,
                                            })
                                        }
                                    />
                                    <Button
                                        type="submit"
                                        size="sm"
                                        className="max-w-full min-w-0"
                                        disabled={
                                            busy ||
                                            editing.content.trim() === ''
                                        }
                                    >
                                        <Check aria-hidden />
                                        <span className="truncate">
                                            {t('Save')}
                                        </span>
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        className="shrink-0"
                                        aria-label={t('Cancel')}
                                        onClick={() => setEditing(null)}
                                    >
                                        <X aria-hidden />
                                    </Button>
                                </form>
                            ) : (
                                <span
                                    className={cn(
                                        'min-w-0 flex-1 basis-32 break-words',
                                        subtask.isCompleted &&
                                            'text-muted-foreground line-through',
                                    )}
                                >
                                    {subtask.content}
                                </span>
                            )}
                            {canManage && editing?.id !== subtask.id && (
                                <span className="flex shrink-0 items-center">
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        className="size-7"
                                        disabled={busy || index === 0}
                                        aria-label={t('Move up')}
                                        onClick={() =>
                                            void send(
                                                endpoints.updateSubtask(
                                                    subtask.id,
                                                ),
                                                { position: index - 1 },
                                            )
                                        }
                                    >
                                        <ArrowUp aria-hidden />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        className="size-7"
                                        disabled={
                                            busy ||
                                            index === subtasks.length - 1
                                        }
                                        aria-label={t('Move down')}
                                        onClick={() =>
                                            void send(
                                                endpoints.updateSubtask(
                                                    subtask.id,
                                                ),
                                                { position: index + 1 },
                                            )
                                        }
                                    >
                                        <ArrowDown aria-hidden />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        className="size-7"
                                        aria-label={t('Edit sub-task')}
                                        onClick={() =>
                                            setEditing({
                                                id: subtask.id,
                                                content: subtask.content,
                                            })
                                        }
                                    >
                                        <Pencil aria-hidden />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        className="size-7 hover:text-skrum-destructive-text"
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
                                        <Trash2 aria-hidden />
                                    </Button>
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {canManage && subtasks.length < MaxSubtasks && (
                <form
                    className="flex min-w-0 flex-wrap items-center gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void add();
                    }}
                >
                    <Input
                        value={draft}
                        maxLength={SubtaskMaxLength}
                        className="h-8 min-w-0 flex-1 basis-40"
                        placeholder={t('Add a sub-task')}
                        aria-label={t('Add a sub-task')}
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="max-w-full min-w-0"
                        disabled={busy || draft.trim() === ''}
                    >
                        <Plus aria-hidden />
                        <span className="truncate">{t('Add')}</span>
                    </Button>
                </form>
            )}
        </div>
    );
}
