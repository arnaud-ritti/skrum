import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type Announcements,
    type DragEndEvent,
    type UniqueIdentifier,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import PokerCurrentTasksController from '@/actions/App/Http/Controllers/Poker/PokerCurrentTasksController';
import PokerTaskOrdersController from '@/actions/App/Http/Controllers/Poker/PokerTaskOrdersController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { sortedTasks } from '@/lib/poker/game-reducer';
import type { PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { TaskFormDialog } from './task-form-dialog';

type Props = { onSelected?: () => void };

export function TasksPane({ onSelected }: Props) {
    const { snapshot, apply, run, refetch } = useGame();
    const { t } = useTrans();
    const [adding, setAdding] = useState(false);
    const { game, me } = snapshot;
    const tasks = sortedTasks(snapshot.tasks);
    const isEnded = game.endedAt !== null;
    const canSort = me.isFacilitator && !isEnded;
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const select = async (task: PokerTask) => {
        if (!canSort || task.id === snapshot.current?.taskId) {
            onSelected?.();

            return;
        }

        const result = await run(
            retroRequest(PokerCurrentTasksController.update(game.id), {
                task_id: task.id,
            }),
        );

        if (result !== undefined) {
            await refetch();
        }

        onSelected?.();
    };

    const titleOf = (id: UniqueIdentifier | undefined): string =>
        tasks.find((task) => task.id === id)?.title ?? '';

    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            t('Picked up :task.', { task: titleOf(active.id) }),
        onDragOver: ({ active, over }) =>
            over
                ? t('Moved :task to position :position.', {
                      task: titleOf(active.id),
                      position:
                          tasks.findIndex((task) => task.id === over.id) + 1,
                  })
                : undefined,
        onDragEnd: ({ active }) =>
            t('Dropped :task.', { task: titleOf(active.id) }),
        onDragCancel: () => t('Reordering cancelled.'),
    };

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }

        const ids = tasks.map((task) => task.id);
        const next = arrayMove(
            ids,
            ids.indexOf(String(active.id)),
            ids.indexOf(String(over.id)),
        );

        apply({ type: 'tasks.reorder', taskIds: next });

        await run(
            retroRequest(PokerTaskOrdersController.update(game.id), {
                task_ids: next,
            }),
        );
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 border-b p-3">
                <h2 className="font-semibold">
                    {t('Tasks')}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                        ({tasks.length})
                    </span>
                </h2>
                {me.canEditTasks && !isEnded && (
                    <Button size="sm" onClick={() => setAdding(true)}>
                        <Plus className="size-4" />
                        {t('Add task')}
                    </Button>
                )}
            </div>

            {tasks.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                    {t('No tasks yet.')}
                </p>
            ) : (
                <DndContext
                    id="poker-tasks"
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    accessibility={{
                        announcements,
                        screenReaderInstructions: {
                            draggable: t(
                                'To pick up a task, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, or Escape to cancel.',
                            ),
                        },
                    }}
                    onDragEnd={(event) => void handleDragEnd(event)}
                >
                    <SortableContext
                        items={tasks.map((task) => task.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <ol className="flex-1 divide-y overflow-y-auto">
                            {tasks.map((task) => (
                                <TaskRow
                                    key={task.id}
                                    task={task}
                                    sortable={canSort}
                                    selectable={canSort}
                                    onSelect={() => void select(task)}
                                />
                            ))}
                        </ol>
                    </SortableContext>
                </DndContext>
            )}

            <TaskFormDialog
                task={null}
                open={adding}
                onOpenChange={setAdding}
            />
        </div>
    );
}

function TaskRow({
    task,
    sortable,
    selectable,
    onSelect,
}: {
    task: PokerTask;
    sortable: boolean;
    selectable: boolean;
    onSelect: () => void;
}) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id, disabled: !sortable });
    const isCurrent = snapshot.current?.taskId === task.id;
    const firstLine = task.description?.split('\n')[0]?.trim() ?? '';

    const content: ReactNode = (
        <>
            <span className="flex items-start gap-2">
                <span className="min-w-0 flex-1 font-medium break-words">
                    {task.title}
                </span>
                {task.estimate !== null && (
                    <Badge variant="secondary">{task.estimate}</Badge>
                )}
                {isCurrent && snapshot.current && (
                    <Badge>
                        {t('Votes: :count', {
                            count: snapshot.current.round.votesCount,
                        })}
                    </Badge>
                )}
            </span>
            {firstLine !== '' && (
                <span className="line-clamp-1 text-xs text-muted-foreground">
                    {firstLine}
                </span>
            )}
        </>
    );

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            data-dragging={isDragging}
            aria-current={isCurrent ? 'true' : undefined}
            className={cn(
                'flex items-start gap-2 bg-background p-3 data-[dragging=true]:opacity-60',
                isCurrent && 'bg-accent',
            )}
        >
            {sortable && (
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    className="mt-0.5 cursor-grab text-muted-foreground"
                    aria-label={t('Drag to reorder')}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" />
                </button>
            )}
            {selectable ? (
                <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                    onClick={onSelect}
                >
                    {content}
                </button>
            ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {content}
                </div>
            )}
        </li>
    );
}
