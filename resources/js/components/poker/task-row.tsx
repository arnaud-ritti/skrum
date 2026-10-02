import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { PokerTask } from '@/lib/poker/types';
import { cn } from '@/lib/utils';
import { TaskSourceChip } from './task-source';

type Props = {
    task: PokerTask;
    /** The round being played on this task; null when it is not the current one. */
    round: { number: number; votesCount: number } | null;
    sortable: boolean;
    selectable: boolean;
    onSelect: () => void;
};

/**
 * One task of the queue. The title is the first text of the row in the
 * document; the ticket is shown above it with `order`.
 */
export function TaskRow({
    task,
    round,
    sortable,
    selectable,
    onSelect,
}: Props) {
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
    const isCurrent = round !== null;
    const isDone = task.estimate !== null && !isCurrent;
    const hasMeta = task.external !== null || isCurrent;

    const content = (
        <>
            <span className="flex min-w-0 flex-col gap-1">
                <span
                    className={cn(
                        'order-2 text-sm/snug break-words',
                        isCurrent ? 'font-semibold' : 'font-medium',
                        isDone && 'text-muted-foreground',
                    )}
                >
                    {task.title}
                </span>
                {hasMeta && (
                    <span className="order-1 flex min-w-0 flex-wrap items-center gap-2">
                        {task.external && (
                            <TaskSourceChip external={task.external} />
                        )}
                        {round !== null && (
                            <span className="text-xs font-semibold whitespace-nowrap text-skrum-primary-text">
                                {t('Round :number', { number: round.number })}
                            </span>
                        )}
                    </span>
                )}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
                {task.estimate !== null && (
                    <Badge variant="success" shape="pill">
                        {task.estimate}
                    </Badge>
                )}
                {round !== null && (
                    <Badge variant="soft" shape="pill">
                        {t('Votes: :count', { count: round.votesCount })}
                    </Badge>
                )}
            </span>
        </>
    );
    const contentClassName =
        'grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-left';

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            data-test="poker-task-row"
            data-dragging={isDragging}
            aria-current={isCurrent ? 'true' : undefined}
            className={cn(
                'flex items-start gap-2 rounded-lg bg-card py-2.5 pr-3 data-[dragging=true]:opacity-60',
                sortable ? 'pl-1' : 'pl-3',
                isCurrent &&
                    'bg-skrum-primary-soft ring-1 ring-primary ring-inset',
            )}
        >
            {sortable && (
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    className={cn(
                        'mt-0.5 shrink-0 cursor-grab rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isCurrent
                            ? 'text-skrum-primary-text'
                            : 'text-muted-foreground',
                    )}
                    aria-label={t('Drag to reorder')}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" aria-hidden />
                </button>
            )}
            {selectable ? (
                <button
                    type="button"
                    className={cn(
                        contentClassName,
                        'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    onClick={onSelect}
                >
                    {content}
                </button>
            ) : (
                <div className={contentClassName}>{content}</div>
            )}
        </li>
    );
}
