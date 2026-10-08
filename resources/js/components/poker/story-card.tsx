import { usePage } from '@inertiajs/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import PokerRoundsController from '@/actions/App/Http/Controllers/Poker/PokerRoundsController';
import PokerTasksController from '@/actions/App/Http/Controllers/Poker/PokerTasksController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { PokerRounds } from '@/components/skrum/poker-rounds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { taskPosition } from '@/lib/poker/room-adapters';
import type { PokerRound, PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { MarkdownClasses } from './markdown-classes';
import { Rejected, TaskFormDialog } from './room-dialogs';
import { TaskSourceDetails, TaskSourceLink } from './task-source';
import { TicketChips, TicketCriteria } from './ticket-details';

type LoadedRounds =
    | { state: 'loading' }
    | { state: 'failed' }
    | { state: 'ready'; rounds: PokerRound[] };

/**
 * The rounds of the task, fetched while the list is open and again when a
 * round is added or revealed.
 */
function TaskRounds({
    task,
    defaultOpen,
}: {
    task: PokerTask;
    defaultOpen: boolean;
}) {
    const { snapshot, handleError, loadRounds } = useGame();
    const { locale } = usePage().props;
    // Open or folded as the screen asks, until the viewer chooses.
    const [chosen, setChosen] = useState<boolean | null>(null);
    const open = chosen ?? defaultOpen;
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

        const request = loadRounds
            ? loadRounds(taskId)
            : retroRequest<PokerRound[]>(
                  PokerRoundsController.index({ game: gameId, task: taskId }),
              );

        request
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
    }, [open, gameId, taskId, revision, handleError, loadRounds]);

    return (
        <PokerRounds
            rounds={loaded.state === 'ready' ? loaded.rounds : []}
            players={snapshot.players}
            count={task.roundsCount}
            status={loaded.state}
            isNumeric={snapshot.game.isNumeric}
            locale={locale}
            open={open}
            onOpenChange={setChosen}
            scrollable
            compact
            currentRoundId={currentRound?.id ?? null}
        />
    );
}

type Props = {
    task: PokerTask;
    /**
     * The rounds are listed open (the owner's fourth round, D-67); false on a
     * phone, where the mockup keeps them folded.
     */
    roundsOpen?: boolean;
    className?: string;
};

/**
 * The task being estimated: its place in the game, its text, its source and
 * its rounds. Beside the text, the acceptance criteria with the rounds under
 * both (ScreenPokerBefore), or the rounds when there are no criteria
 * (ScreenPokerQueue).
 */
export function StoryCard({ task, roundsOpen = true, className }: Props) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const { game, me } = snapshot;
    const isEnded = game.endedAt !== null;
    const position = taskPosition(snapshot.tasks, task.id);
    const hasRounds = task.roundsCount > 0;
    const hasCriteria = task.acceptanceCriteriaHtml !== '';

    const destroy = async (): Promise<void> => {
        const result = await run(
            retroRequest(
                PokerTasksController.destroy({ game: game.id, task: task.id }),
            ),
        );

        if (result === undefined) {
            throw new Rejected();
        }

        apply({ type: 'task.remove', taskId: task.id });
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
                    hasCriteria &&
                        '@3xl/story:grid-cols-[minmax(0,1fr)_16.25rem] @3xl/story:gap-x-6',
                    !hasCriteria &&
                        hasRounds &&
                        '@3xl/story:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] @3xl/story:gap-6',
                )}
            >
                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {task.external && (
                            <TaskSourceLink external={task.external} />
                        )}
                        <TicketChips external={task.external} />
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
                    {task.external && (
                        <TaskSourceDetails
                            task={task}
                            external={task.external}
                        />
                    )}
                    {task.descriptionHtml !== '' && (
                        <details className="min-w-0">
                            <summary className="cursor-pointer rounded-sm text-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
                                {t('Description')}
                            </summary>
                            <div
                                data-slot="story-description"
                                className={cn(
                                    MarkdownClasses,
                                    'mt-2 text-muted-foreground',
                                )}
                                dangerouslySetInnerHTML={{
                                    __html: task.descriptionHtml,
                                }}
                            />
                        </details>
                    )}
                </div>
                {hasCriteria && (
                    <TicketCriteria html={task.acceptanceCriteriaHtml} />
                )}
                {hasRounds && (
                    <div
                        data-slot="story-rounds"
                        className={cn(
                            'flex min-w-0 flex-col',
                            hasCriteria
                                ? 'border-t border-border pt-3 @3xl/story:col-span-full'
                                : '@3xl/story:border-l @3xl/story:border-border @3xl/story:pl-5',
                        )}
                    >
                        <TaskRounds task={task} defaultOpen={roundsOpen} />
                    </div>
                )}
            </div>

            <TaskFormDialog
                task={task}
                open={editing}
                onOpenChange={setEditing}
            />

            <ConfirmDialog
                open={confirmingDelete}
                onOpenChange={setConfirmingDelete}
                tone="destructive"
                title={t('Delete this task?')}
                description={t('Its rounds and votes are deleted too.')}
                confirmLabel={t('Delete')}
                onConfirm={destroy}
            />
        </section>
    );
}
