import { useState, type FormEvent } from 'react';
import PokerTasksController from '@/actions/App/Http/Controllers/Poker/PokerTasksController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import type { PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { MarkdownClasses } from './markdown-classes';

type Props = {
    task: PokerTask | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function TaskFormDialog({ task, open, onOpenChange }: Props) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-2xl"
            >
                <DialogTitle>
                    {task ? t('Edit task') : t('Add task')}
                </DialogTitle>
                {open && (
                    <TaskForm task={task} onDone={() => onOpenChange(false)} />
                )}
            </DialogContent>
        </Dialog>
    );
}

function TaskForm({
    task,
    onDone,
}: {
    task: PokerTask | null;
    onDone: () => void;
}) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [title, setTitle] = useState(task?.title ?? '');
    const [description, setDescription] = useState(task?.description ?? '');
    const [tab, setTab] = useState<'write' | 'preview'>('write');
    const [busy, setBusy] = useState(false);
    const gameId = snapshot.game.id;
    const savedHtml =
        task && (task.description ?? '') === description
            ? task.descriptionHtml
            : null;

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);

        const payload = {
            title: title.trim(),
            description: description.trim() === '' ? null : description,
        };
        const saved = await run(
            retroRequest<PokerTask>(
                task
                    ? PokerTasksController.update({
                          game: gameId,
                          task: task.id,
                      })
                    : PokerTasksController.store(gameId),
                payload,
            ),
        );

        setBusy(false);

        if (saved) {
            apply({ type: 'task.upsert', task: saved });
            onDone();
        }
    };

    return (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="poker-task-title">{t('Title')}</Label>
                <Input
                    id="poker-task-title"
                    required
                    maxLength={200}
                    autoFocus
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                />
            </div>

            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="poker-task-description">
                        {t('Description')}
                    </Label>
                    <div role="tablist" className="flex gap-1">
                        {(['write', 'preview'] as const).map((name) => (
                            <Button
                                key={name}
                                type="button"
                                role="tab"
                                size="sm"
                                variant={tab === name ? 'secondary' : 'ghost'}
                                aria-selected={tab === name}
                                onClick={() => setTab(name)}
                            >
                                {name === 'write' ? t('Write') : t('Preview')}
                            </Button>
                        ))}
                    </div>
                </div>
                {tab === 'write' ? (
                    <>
                        <Textarea
                            id="poker-task-description"
                            rows={8}
                            maxLength={10000}
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('Markdown is supported.')}
                        </p>
                    </>
                ) : savedHtml !== null && savedHtml !== '' ? (
                    <div
                        className={cn(
                            MarkdownClasses,
                            'min-h-24 rounded-md border p-3',
                        )}
                        dangerouslySetInnerHTML={{ __html: savedHtml }}
                    />
                ) : (
                    <p className="min-h-24 rounded-md border p-3 text-sm text-muted-foreground">
                        {t('Save to preview')}
                    </p>
                )}
            </div>

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button disabled={busy || title.trim() === ''}>
                    {t('Save')}
                </Button>
            </DialogFooter>
        </form>
    );
}
