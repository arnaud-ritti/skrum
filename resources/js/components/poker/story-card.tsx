import { usePage } from '@inertiajs/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import PokerRoundsController from '@/actions/App/Http/Controllers/Poker/PokerRoundsController';
import PokerTasksController from '@/actions/App/Http/Controllers/Poker/PokerTasksController';
import { PokerRounds } from '@/components/skrum/poker-rounds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { taskPosition } from '@/lib/poker/room-adapters';
import type { PokerRound, PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { MarkdownClasses } from './markdown-classes';
import { TaskFormDialog } from './room-dialogs';
import { TaskSourceDetails, TaskSourceLink } from './task-source';

type LoadedRounds =
    | { state: 'loading' }
    | { state: 'failed' }
    | { state: 'ready'; rounds: PokerRound[] };

/** The rounds of the task, fetched when the list is opened and again when a round is added or revealed. */
function TaskRounds({ task }: { task: PokerTask }) {
    const { snapshot, handleError } = useGame();
    const { locale } = usePage().props;
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState<LoadedRounds>({ state: 'loading' });
    const currentRound =
        snapshot.current?.taskId === task.id ? snapshot.current.round : null;
    const revision = `${task.roundsCount}:${currentRound?.id ?? ''}:${currentRound?.revealedAt ?? ''}`;
    const gameId = snapshot.game.id;
    const taskId = task.id;

    useEffect(() => {
        if (!open) {
            return;
        }

        let isCurrent = true;

        retroRequest<PokerRound[]>(
            PokerRoundsController.index({ game: gameId, task: taskId }),
        )
            .then((rounds) => {
                if (isCurrent) {
                    setLoaded({ state: 'ready', rounds });
                }
            })
            .catch((error: unknown) => {
                if (isCurrent) {
                    handleError(error);
                    setLoaded({ state: 'failed' });
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [open, gameId, taskId, revision, handleError]);

    return (
        <PokerRounds
            rounds={loaded.state === 'ready' ? loaded.rounds : []}
            players={snapshot.players}
            count={task.roundsCount}
            status={loaded.state}
            isNumeric={snapshot.game.isNumeric}
            locale={locale}
            open={open}
            onOpenChange={setOpen}
        />
    );
}

type Props = {
    task: PokerTask;
    /** Under the title: type and label chips, description and acceptance criteria of the ticket (PK-1). Nothing today. */
    details?: ReactNode;
    className?: string;
};

/** The task being estimated: its place in the game, its text, its source and its rounds. */
export function StoryCard({ task, details, className }: Props) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const { game, me } = snapshot;
    const isEnded = game.endedAt !== null;
    const position = taskPosition(snapshot.tasks, task.id);
    const hasRounds = task.roundsCount > 0;

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
            data-slot="story-card"
            className={cn(
                '@container/story w-full shrink-0 rounded-xl border border-border bg-card shadow-card',
                className,
            )}
        >
            <div
                className={cn(
                    'grid gap-4 px-5 py-4',
                    hasRounds &&
                        '@3xl/story:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] @3xl/story:gap-6',
                )}
            >
                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {task.external && (
                            <TaskSourceLink external={task.external} />
                        )}
                        {position !== null && (
                            <span className="text-xs whitespace-nowrap text-muted-foreground">
                                {t(':position / :total in this game', {
                                    position,
                                    total: snapshot.tasks.length,
                                })}
                            </span>
                        )}
                        {task.estimate !== null && (
                            <Badge variant="success" shape="pill">
                                {t('Estimate: :value', {
                                    value: task.estimate,
                                })}
                            </Badge>
                        )}
                        <span className="flex-1" />
                        {me.canEditTasks &&
                            !isEnded &&
                            task.external === null && (
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={t('Edit task')}
                                    onClick={() => setEditing(true)}
                                >
                                    <Pencil aria-hidden />
                                </Button>
                            )}
                        {me.isFacilitator && !isEnded && (
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={t('Delete task')}
                                onClick={() => setConfirmingDelete(true)}
                            >
                                <Trash2 aria-hidden />
                            </Button>
                        )}
                    </div>
                    <h2
                        id={`poker-task-${task.id}`}
                        className="min-w-0 text-xl font-title tracking-subheading break-words"
                    >
                        {task.title}
                    </h2>
                    {details}
                    {task.external && (
                        <TaskSourceDetails
                            task={task}
                            external={task.external}
                        />
                    )}
                    {task.descriptionHtml !== '' && (
                        <div
                            className={cn(
                                MarkdownClasses,
                                'text-muted-foreground',
                            )}
                            dangerouslySetInnerHTML={{
                                __html: task.descriptionHtml,
                            }}
                        />
                    )}
                </div>
                {hasRounds && (
                    <div
                        data-slot="story-rounds"
                        className="flex min-w-0 flex-col @3xl/story:border-l @3xl/story:border-border @3xl/story:pl-5"
                    >
                        <TaskRounds task={task} />
                    </div>
                )}
            </div>

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
                            type="button"
                            variant="outline"
                            onClick={() => setConfirmingDelete(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => void destroy()}
                        >
                            <Trash2 aria-hidden />
                            {t('Delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
