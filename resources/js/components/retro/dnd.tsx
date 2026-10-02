import {
    useDraggable,
    useDroppable,
    type Announcements,
    type ScreenReaderInstructions,
    type UniqueIdentifier,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { Snapshot } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

/** What a card shows of the drag it takes part in. */
export type CardDragState = { isDragging: boolean; isDropTarget: boolean };

const handleClass =
    'rounded-lg outline-ring focus-visible:outline-2 focus-visible:outline-offset-2';

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

        const card = board.cards.find((card) => card.id === target?.id);

        if (!card || card.hidden) {
            return t('a hidden card');
        }

        return card.content === null ? t('GIF') : `“${card.content}”`;
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

/** The element of a card that starts its drag: what Space is pressed on. */
export const DragHandleSelector = '[data-drag-handle]';

/**
 * Starts the keyboard move of the card a key was pressed on, exactly as
 * Space on its drag handle: the handle takes the focus and receives the key
 * the keyboard sensor of the board listens to.
 */
export function startKeyboardDrag(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
        return false;
    }

    const handle = target.closest<HTMLElement>(DragHandleSelector);

    if (handle === null) {
        return false;
    }

    handle.focus();
    handle.dispatchEvent(
        new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true,
        }),
    );

    return true;
}

export function SortableCard({
    id,
    disabled,
    children,
}: {
    id: string;
    disabled: boolean;
    children: (state: CardDragState) => ReactNode;
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
            data-test={`retro-card-handle-${id}`}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            data-drag-handle={disabled ? undefined : ''}
            className={cn(handleClass, !disabled && 'cursor-grab')}
            {...attributes}
            {...listeners}
        >
            {children({ isDragging, isDropTarget: false })}
        </div>
    );
}

/**
 * Spread onto interactive content rendered inside a draggable card (also
 * portaled content such as dialogs and menus, whose React events still bubble
 * to the card) so typing and clicking never start a drag.
 */
export const dragIsolation = {
    onKeyDown: (event: KeyboardEvent) => event.stopPropagation(),
    onPointerDown: (event: PointerEvent) => event.stopPropagation(),
};

export function GroupableCard({
    id,
    disabled,
    children,
}: {
    id: string;
    disabled: boolean;
    children: (state: CardDragState) => ReactNode;
}) {
    const drag = useDraggable({ id: `card:${id}`, disabled });
    const drop = useDroppable({ id: `card:${id}` });
    const isDropTarget = drop.isOver && !drag.isDragging;

    return (
        <div
            ref={(node) => {
                drag.setNodeRef(node);
                drop.setNodeRef(node);
            }}
            data-test={`retro-card-handle-${id}`}
            data-drag-handle={disabled ? undefined : ''}
            className={cn(handleClass, !disabled && 'cursor-grab')}
            {...drag.attributes}
            {...drag.listeners}
        >
            {children({ isDragging: drag.isDragging, isDropTarget })}
        </div>
    );
}

/** The column as a place to drop a card: its ref and whether a card is over it. */
export function useColumnDropZone(id: string): {
    setNodeRef: (node: HTMLElement | null) => void;
    isOver: boolean;
} {
    const { setNodeRef, isOver } = useDroppable({ id: `column:${id}` });

    return { setNodeRef, isOver };
}
