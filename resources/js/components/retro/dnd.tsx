import {
    useDraggable,
    useDroppable,
    type Announcements,
    type ScreenReaderInstructions,
    type UniqueIdentifier,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { Snapshot } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

export function parseDndId(
    id: string | number | undefined | null,
): { kind: 'card' | 'column'; id: string } | null {
    if (typeof id !== 'string') {
        return null;
    }

    const [kind, value] = id.split(':');

    if ((kind !== 'card' && kind !== 'column') || !value) {
        return null;
    }

    return { kind, id: value };
}

export function useDragAccessibility(board: Snapshot): {
    announcements: Announcements;
    screenReaderInstructions: ScreenReaderInstructions;
} {
    const { t } = useTrans();

    const describe = (id: UniqueIdentifier | undefined): string => {
        const target = parseDndId(id);

        if (target?.kind === 'column') {
            const title =
                board.columns.find((column) => column.id === target.id)
                    ?.title ?? '';

            return t('column :title', { title });
        }

        const content = board.cards.find(
            (card) => card.id === target?.id,
        )?.content;

        return content ? `“${content}”` : t('a hidden card');
    };

    return {
        screenReaderInstructions: {
            draggable: t(
                'To pick up a card, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, or Escape to cancel.',
            ),
        },
        announcements: {
            onDragStart: ({ active }) =>
                t('Picked up :card.', { card: describe(active.id) }),
            onDragOver: ({ active, over }) =>
                over
                    ? t(':card is over :target.', {
                          card: describe(active.id),
                          target: describe(over.id),
                      })
                    : t(':card is no longer over a drop area.', {
                          card: describe(active.id),
                      }),
            onDragEnd: ({ active, over }) =>
                over
                    ? t('Dropped :card on :target.', {
                          card: describe(active.id),
                          target: describe(over.id),
                      })
                    : t('Dropped :card.', { card: describe(active.id) }),
            onDragCancel: ({ active }) =>
                t('Cancelled moving :card.', { card: describe(active.id) }),
        },
    };
}

export function SortableCard({
    id,
    disabled,
    children,
}: {
    id: string;
    disabled: boolean;
    children: ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `card:${id}`,
        disabled: { draggable: disabled, droppable: false },
    });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                isDragging && 'opacity-50',
                !disabled && 'cursor-grab',
            )}
            {...attributes}
            {...listeners}
        >
            {children}
        </div>
    );
}

export function GroupableCard({
    id,
    children,
}: {
    id: string;
    children: ReactNode;
}) {
    const drag = useDraggable({ id: `card:${id}` });
    const drop = useDroppable({ id: `card:${id}` });

    return (
        <div
            ref={(node) => {
                drag.setNodeRef(node);
                drop.setNodeRef(node);
            }}
            style={{ transform: CSS.Translate.toString(drag.transform) }}
            className={cn(
                'cursor-grab rounded-md',
                drag.isDragging && 'opacity-50',
                drop.isOver &&
                    !drag.isDragging &&
                    'ring-2 ring-primary ring-offset-2',
            )}
            {...drag.attributes}
            {...drag.listeners}
        >
            {children}
        </div>
    );
}

export function ColumnDropZone({
    id,
    children,
    className,
}: {
    id: string;
    children: ReactNode;
    className?: string;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `column:${id}` });

    return (
        <div
            ref={setNodeRef}
            className={cn(className, isOver && 'bg-primary/5')}
        >
            {children}
        </div>
    );
}
