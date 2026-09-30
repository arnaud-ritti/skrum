import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import PokerTasksController from '@/actions/App/Http/Controllers/Poker/PokerTasksController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import type { PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';
import { RoundHistory } from './round-history';
import { TaskFormDialog } from './task-form-dialog';

/**
 * The app has no typography plugin; these descendant styles give the
 * server-rendered Markdown readable defaults.
 */
export const MarkdownClasses =
    'space-y-2 text-sm break-words [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_h1]:text-base [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5';

export function TaskDetail({ task }: { task: PokerTask }) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const { game, me } = snapshot;
    const isEnded = game.endedAt !== null;

    const destroy = async () => {
        setBusy(true);

        const result = await run(
            retroRequest(
                PokerTasksController.destroy({ game: game.id, task: task.id }),
            ),
        );

        setBusy(false);

        if (result !== undefined) {
            setConfirmingDelete(false);
            apply({ type: 'task.remove', taskId: task.id });
        }
    };

    return (
        <section
            aria-labelledby={`poker-task-${task.id}`}
            className="space-y-3 rounded-md border p-4"
        >
            <div className="flex flex-wrap items-start gap-2">
                <h2
                    id={`poker-task-${task.id}`}
                    className="min-w-0 flex-1 text-lg font-semibold break-words"
                >
                    {task.title}
                </h2>
                {task.estimate !== null && (
                    <Badge>
                        {t('Estimate: :value', { value: task.estimate })}
                    </Badge>
                )}
                {me.canEditTasks && !isEnded && (
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('Edit task')}
                        onClick={() => setEditing(true)}
                    >
                        <Pencil className="size-4" />
                    </Button>
                )}
                {me.isFacilitator && !isEnded && (
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('Delete task')}
                        onClick={() => setConfirmingDelete(true)}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                )}
            </div>

            {task.descriptionHtml !== '' && (
                <div
                    className={MarkdownClasses}
                    dangerouslySetInnerHTML={{ __html: task.descriptionHtml }}
                />
            )}

            {task.roundsCount > 0 && (
                <Collapsible>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="group">
                            {t('Rounds (:count)', { count: task.roundsCount })}
                            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                        <RoundHistory taskId={task.id} />
                    </CollapsibleContent>
                </Collapsible>
            )}

            <TaskFormDialog
                task={task}
                open={editing}
                onOpenChange={setEditing}
            />

            <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
                <DialogContent>
                    <DialogTitle>{t('Delete this task?')}</DialogTitle>
                    <DialogDescription>
                        {t('Its rounds and votes are deleted too.')}
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => setConfirmingDelete(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={() => void destroy()}
                        >
                            {t('Delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
