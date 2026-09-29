import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
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
