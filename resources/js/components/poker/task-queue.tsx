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
    type SortingStrategy,
} from '@dnd-kit/sortable';
import { usePage } from '@inertiajs/react';
import { Download, MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import PokerImportRefreshesController from '@/actions/App/Http/Controllers/Integrations/PokerImportRefreshesController';
import PokerCurrentTasksController from '@/actions/App/Http/Controllers/Poker/PokerCurrentTasksController';
import PokerSettingsController from '@/actions/App/Http/Controllers/Poker/PokerSettingsController';
import PokerTaskOrdersController from '@/actions/App/Http/Controllers/Poker/PokerTaskOrdersController';
import PokerTasksController from '@/actions/App/Http/Controllers/Poker/PokerTasksController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { formatPoints } from '@/lib/poker/format';
import { sortedTasks } from '@/lib/poker/game-reducer';
import { estimatedPoints } from '@/lib/poker/room-adapters';
import {
    connectedTrackers,
    TrackerLabels,
    type PokerTask,
} from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';
import { ImportTasksDialog } from './import-tasks-dialog';
import { TaskFormDialog } from './room-dialogs';
import { TaskRow } from './task-row';

/**
 * The rows stay where they are while one is dragged: a line shows where it
 * lands (see `TaskRow`), nothing moves apart.
 */
const keepRowsInPlace: SortingStrategy = () => null;

type Props = {
    /** Called once a task was picked: the phone drawer closes. */
    onSelected?: () => void;
};

/** The task queue: the list, its order, what is added to it and the facilitator's summary. */
export function TaskQueue({ onSelected }: Props) {
    const { snapshot, apply, run, refetch } = useGame();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [adding, setAdding] = useState(false);
    const [importing, setImporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const { game, me, current } = snapshot;
    const tasks = sortedTasks(snapshot.tasks);
    const isEnded = game.endedAt !== null;
    const canSort = me.isFacilitator && !isEnded;
    const canAdd = me.canEditTasks && !isEnded;
    const trackers = connectedTrackers(snapshot.integrations);
    const canImport = canAdd && trackers.length > 0;
    const refreshableSources = trackers.filter((source) =>
        snapshot.tasks.some((task) => task.external?.source === source),
    );
    const refreshLabel = refreshableSources
        .map((source) => TrackerLabels[source])
        .join(' & ');
    const points = game.isNumeric ? estimatedPoints(tasks) : null;

    const refresh = async () => {
        setRefreshing(true);

        const result = await run(
            retroRequest<{ refreshed: number; missing: number }>(
                PokerImportRefreshesController.store(game.id),
            ),
        );

        setRefreshing(false);

        if (!result) {
            return;
        }

        toast.success(
            t(':count tasks refreshed.', { count: result.refreshed }),
        );

        if (result.missing > 0) {
            toast.warning(
                t(':count tasks were not found in :source.', {
                    count: result.missing,
                    source: refreshLabel,
                }),
            );
        }

        await refetch();
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const select = async (task: PokerTask) => {
        if (!canSort || task.id === current?.taskId) {
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
        <div data-slot="task-queue" className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center justify-between gap-2 px-4 pt-4 pb-2">
                <h2 className="flex min-w-0 items-center gap-2 text-base font-title">
                    <span className="truncate">{t('Tasks')}</span>
                    <Badge variant="muted" shape="pill">
                        {tasks.length}
                    </Badge>
                </h2>
                <div className="flex min-w-0 items-center gap-1">
                    {points !== null && (
                        <Badge
                            variant="muted"
                            shape="pill"
                            className="min-w-0 shrink"
                        >
                            <span className="truncate">
                                {t(':count pts estimated', {
                                    count: formatPoints(points, locale),
                                })}
                            </span>
                        </Badge>
                    )}
                    {canImport && refreshableSources.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={t('More task actions')}
                                >
                                    <MoreHorizontal aria-hidden />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    disabled={refreshing}
                                    onSelect={() => void refresh()}
                                >
                                    <RefreshCw aria-hidden />
                                    <span className="truncate">
                                        {t('Refresh from :source', {
                                            source: refreshLabel,
                                        })}
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {tasks.length === 0 ? (
                <p className="px-4 py-2 text-sm text-muted-foreground">
                    {t('No tasks yet.')}
                </p>
            ) : (
                <DndContext
                    id="poker-task-queue"
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
                        strategy={keepRowsInPlace}
                    >
                        <ol
                            data-vaul-no-drag=""
                            className="flex min-h-0 shrink flex-col gap-0.5 overflow-y-auto px-2 py-0.5"
                        >
                            {tasks.map((task) => (
                                <TaskRow
                                    key={task.id}
                                    task={task}
                                    round={
                                        current?.taskId === task.id
                                            ? current.round
                                            : null
                                    }
                                    votesCount={task.votesCount}
                                    sortable={canSort}
                                    selectable={canSort}
                                    onSelect={() => void select(task)}
                                />
                            ))}
                        </ol>
                    </SortableContext>
                </DndContext>
            )}

            {canAdd && (
                <div className="flex flex-col gap-2 px-4 py-3">
                    <QuickAdd />
                    {tasks.length > 0 && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full min-w-0"
                            onClick={() => setAdding(true)}
                        >
                            <Plus aria-hidden />
                            <span className="truncate">{t('Add task')}</span>
                        </Button>
                    )}
                    {canImport && (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="w-full min-w-0"
                            onClick={() => setImporting(true)}
                        >
                            <Download aria-hidden />
                            <span className="truncate">{t('Import')}</span>
                        </Button>
                    )}
                </div>
            )}

            <span className="flex-1" />
            {me.isFacilitator && !isEnded && <FacilitatorSummary />}

            <TaskFormDialog
                task={null}
                open={adding}
                onOpenChange={setAdding}
            />
            <ImportTasksDialog
                open={importing}
                onOpenChange={setImporting}
                sources={trackers}
            />
        </div>
    );
}

/** A title and Enter: the task goes to the end of the queue. The full form adds a description. */
function QuickAdd() {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [title, setTitle] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        const trimmed = title.trim();

        if (trimmed === '' || busy) {
            return;
        }

        setBusy(true);

        const saved = await run(
            retroRequest<PokerTask>(
                PokerTasksController.store(snapshot.game.id),
                { title: trimmed, description: null },
            ),
        );

        setBusy(false);

        if (saved) {
            apply({ type: 'task.upsert', task: saved });
            setTitle('');
        }
    };

    return (
        <form
            data-slot="task-quick-add"
            className="flex min-w-0 gap-2"
            onSubmit={(event) => void submit(event)}
        >
            <Input
                aria-label={t('Add a task…')}
                placeholder={t('Add a task…')}
                maxLength={200}
                value={title}
                className="h-8 min-w-0 flex-1"
                onChange={(event) => setTitle(event.target.value)}
            />
            <Button
                type="submit"
                size="sm"
                className="shrink-0"
                aria-disabled={busy || title.trim() === '' || undefined}
            >
                <Plus aria-hidden />
                <span>{t('Add')}</span>
            </Button>
        </form>
    );
}

/** What the facilitator set for the game, at the foot of the queue. */
function FacilitatorSummary() {
    const { snapshot, online, run, refetch } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { game } = snapshot;
    const onlineIds = new Set(online.map((member) => member.id));
    const watchers = snapshot.players.filter(
        (player) => player.isSpectator && onlineIds.has(player.id),
    );

    const setAutoReveal = async (autoReveal: boolean) => {
        setBusy(true);

        const result = await run(
            retroRequest(PokerSettingsController.update(game.id), {
                auto_reveal: autoReveal,
            }),
        );

        setBusy(false);

        if (result !== undefined) {
            await refetch();
        }
    };

    return (
        <section
            aria-labelledby="poker-facilitator-settings"
            data-slot="queue-facilitator-settings"
            className="flex flex-col gap-2 border-t border-border p-4 text-sm"
        >
            <h3
                id="poker-facilitator-settings"
                className="text-xs font-semibold text-muted-foreground"
            >
                {t('Facilitator settings')}
            </h3>
            <dl className="flex flex-col gap-2">
                <div className="flex min-w-0 items-center justify-between gap-3">
                    <dt>{t('Deck')}</dt>
                    <dd className="min-w-0 truncate text-muted-foreground">
                        {game.deckLabel}
                    </dd>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-3">
                    <dt>
                        <label htmlFor="poker-queue-auto-reveal">
                            {t(
                                'Reveal automatically when everyone has voted or the timer ends',
                            )}
                        </label>
                    </dt>
                    <dd className="flex shrink-0">
                        <Switch
                            id="poker-queue-auto-reveal"
                            checked={game.autoReveal}
                            disabled={busy}
                            onCheckedChange={(checked) =>
                                void setAutoReveal(checked)
                            }
                        />
                    </dd>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-3">
                    <dt>{t('Watching')}</dt>
                    <dd className="min-w-0 truncate text-muted-foreground">
                        {watchers.length === 0
                            ? '0'
                            : `${watchers.length} (${watchers.map((player) => player.name).join(', ')})`}
                    </dd>
                </div>
            </dl>
        </section>
    );
}
