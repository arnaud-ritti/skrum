import {
    DndContext,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import {
    ColumnColorOptions,
    columnColors,
} from '@/components/skrum/column-color-picker';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import type { ColumnColor } from '@/lib/retro/types';
import {
    MaxColumnTitleLength,
    firstFreeColor,
    swapColumnColor,
} from '@/components/skrum/template-editor';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { newDraftColumnId } from '@/lib/retro/template-adapter';
import type { DraftColumn } from '@/lib/retro/template-adapter';
import { cn } from '@/lib/utils';

export type { DraftColumn } from '@/lib/retro/template-adapter';

export type RetroColumnsEditorProps = {
    value: DraftColumn[];
    onChange: (columns: DraftColumn[]) => void;
    max: number;
    colors?: readonly ColumnColor[];
    /** Server errors by field: `columns`, `columns.N.title`, `columns.N.color`. */
    errors?: Record<string, string>;
};

type Grab = { id: string; origin: DraftColumn[] };

const moveSteps: Record<string, number> = {
    ArrowLeft: -1,
    ArrowUp: -1,
    ArrowRight: 1,
    ArrowDown: 1,
};

type ColumnTileProps = {
    column: DraftColumn;
    index: number;
    total: number;
    selected: boolean;
    grabbed: boolean;
    invalid: boolean;
    registerTitle: (id: string, node: HTMLInputElement | null) => void;
    onSelect: () => void;
    onTitleChange: (title: string) => void;
    onHandleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
    onHandleBlur: () => void;
};

function ColumnTile({
    column,
    index,
    total,
    selected,
    grabbed,
    invalid,
    registerTitle,
    onSelect,
    onTitleChange,
    onHandleKeyDown,
    onHandleBlur,
}: ColumnTileProps) {
    const { t } = useTrans();
    const {
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: column.id });
    const displayTitle =
        column.title.trim() === '' ? t('Untitled') : column.title;

    return (
        <li
            ref={setNodeRef}
            data-slot="retro-column-draft"
            data-selected={selected ? 'true' : undefined}
            data-color={column.color}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            onPointerDown={onSelect}
            onFocusCapture={onSelect}
            className={cn(
                'flex min-w-0 flex-col gap-1.5 rounded-md border border-(--col-border) bg-(--col) p-2 motion-reduce:transition-none',
                columnColorClass(column.color),
                selected && 'ring-2 ring-ring',
                (isDragging || grabbed) && 'shadow-drag',
                invalid && 'border-destructive',
            )}
        >
            <div className="flex min-w-0 items-center gap-1.5">
                <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full bg-(--col-border)"
                />
                <input
                    ref={(node) => registerTitle(column.id, node)}
                    value={column.title}
                    aria-label={t('Column :position title', {
                        position: index + 1,
                    })}
                    aria-invalid={invalid || undefined}
                    placeholder={t('Column title')}
                    maxLength={MaxColumnTitleLength}
                    onChange={(event) => onTitleChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                        }
                    }}
                    className="min-w-0 flex-1 truncate rounded-xs bg-transparent text-xs font-semibold text-(--col-text) outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                    ref={setActivatorNodeRef}
                    type="button"
                    {...listeners}
                    aria-roledescription={t('sortable')}
                    aria-pressed={grabbed ? true : undefined}
                    aria-label={t(
                        'Reorder “:title”, position :position of :total',
                        { title: displayTitle, position: index + 1, total },
                    )}
                    onKeyDown={onHandleKeyDown}
                    onBlur={onHandleBlur}
                    className="grid size-5 shrink-0 cursor-grab touch-none place-items-center rounded-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing aria-pressed:text-foreground"
                >
                    <GripVertical aria-hidden className="size-3" />
                </button>
            </div>
            {column.description ? (
                <span className="truncate text-overline font-normal tracking-normal text-muted-foreground">
                    {column.description}
                </span>
            ) : null}
            <span
                aria-hidden
                className="h-4 rounded-sm border border-(--col-border) bg-(--col)"
            />
            <span
                aria-hidden
                className="h-4 w-2/3 rounded-sm border border-(--col-border) bg-(--col)"
            />
        </li>
    );
}

/**
 * The columns of the board about to be created: a mini board whose columns
 * are renamed in place, reordered with the grip (pointer, or Space then the
 * arrows), recoloured and deleted through the row under the board.
 */
export function RetroColumnsEditor({
    value,
    onChange,
    max,
    colors = columnColors,
    errors = {},
}: RetroColumnsEditorProps): ReactElement {
    const { t } = useTrans();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [grab, setGrab] = useState<Grab | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const titleRefs = useRef(new Map<string, HTMLInputElement>());
    const pendingFocus = useRef<string | null>(null);
    const latest = useRef(value);

    latest.current = value;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    );
    const selected =
        value.find((column) => column.id === selectedId) ?? value[0];
    const selectedIndex = selected === undefined ? -1 : value.indexOf(selected);
    const full = value.length >= max;

    useEffect(() => {
        if (pendingFocus.current === null) {
            return;
        }

        titleRefs.current.get(pendingFocus.current)?.focus();
        pendingFocus.current = null;
    }, [value.length]);

    /**
     * Radix closes a dialog from a capture listener on `document`. Escape that
     * cancels a move is taken on `window`, one step earlier.
     */
    useEffect(() => {
        if (grab === null) {
            return;
        }

        function cancelOnEscape(event: globalThis.KeyboardEvent): void {
            if (event.key !== 'Escape' || grab === null) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            onChange(grab.origin);
            setGrab(null);
            setAnnouncement(
                t(
                    'Move cancelled, “:title” back at position :position of :total',
                    {
                        title: titleOf(grab.origin, grab.id, t('Untitled')),
                        position:
                            grab.origin.findIndex(
                                (column) => column.id === grab.id,
                            ) + 1,
                        total: grab.origin.length,
                    },
                ),
            );
        }

        window.addEventListener('keydown', cancelOnEscape, true);

        return () =>
            window.removeEventListener('keydown', cancelOnEscape, true);
    }, [grab, onChange, t]);

    const registerTitle = (id: string, node: HTMLInputElement | null): void => {
        if (node === null) {
            titleRefs.current.delete(id);

            return;
        }

        titleRefs.current.set(id, node);
    };

    const describe = (columns: DraftColumn[], id: string) => ({
        title: titleOf(columns, id, t('Untitled')),
        position: columns.findIndex((column) => column.id === id) + 1,
        total: columns.length,
    });

    const handleKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        column: DraftColumn,
    ): void => {
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();

            if (grab?.id === column.id) {
                setGrab(null);
                setAnnouncement(
                    t(
                        '“:title” dropped at position :position of :total',
                        describe(latest.current, column.id),
                    ),
                );

                return;
            }

            setGrab({ id: column.id, origin: latest.current });
            setAnnouncement(
                t(
                    'Picked up “:title”, position :position of :total',
                    describe(latest.current, column.id),
                ),
            );

            return;
        }

        if (grab?.id !== column.id || !(event.key in moveSteps)) {
            return;
        }

        event.preventDefault();

        const from = latest.current.findIndex((item) => item.id === column.id);
        const to = from + moveSteps[event.key];

        if (to < 0 || to >= latest.current.length) {
            return;
        }

        const moved = arrayMove(latest.current, from, to);

        onChange(moved);
        setAnnouncement(
            t(
                '“:title” moved to position :position of :total',
                describe(moved, column.id),
            ),
        );
    };

    const handleDragEnd = ({ active, over }: DragEndEvent): void => {
        if (over === null || active.id === over.id) {
            return;
        }

        const from = value.findIndex((column) => column.id === active.id);
        const to = value.findIndex((column) => column.id === over.id);

        if (from === -1 || to === -1) {
            return;
        }

        onChange(arrayMove(value, from, to));
    };

    const addColumn = (): void => {
        if (full) {
            return;
        }

        const column: DraftColumn = {
            id: newDraftColumnId(),
            title: '',
            description: null,
            color: firstFreeColor(value, colors) as ColumnColor,
        };

        pendingFocus.current = column.id;
        setSelectedId(column.id);
        onChange([...value, column]);
    };

    const removeSelected = (): void => {
        if (selected === undefined || value.length <= 1) {
            return;
        }

        const next = value.filter((column) => column.id !== selected.id);

        setSelectedId(next[Math.min(selectedIndex, next.length - 1)].id);
        onChange(next);
    };

    const usedBy = Object.fromEntries(
        value
            .filter((column) => column.id !== selected?.id)
            .map((column) => [
                column.color,
                column.title.trim() === '' ? t('Untitled') : column.title,
            ]),
    ) as Partial<Record<ColumnColor, string>>;
    const columnErrors = Object.entries(errors).filter(([field]) =>
        field.startsWith('columns'),
    );

    return (
        <div data-slot="retro-columns-editor" className="flex flex-col gap-2">
            <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">
                    {t('Columns · :count', { count: value.length })}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={full}
                    onClick={addColumn}
                    className="max-w-full shrink-0"
                >
                    <Plus aria-hidden />
                    <span className="truncate">{t('Add a column')}</span>
                </Button>
            </div>
            {value.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={value.map((column) => column.id)}
                        strategy={rectSortingStrategy}
                    >
                        <ul
                            aria-label={t('Columns')}
                            className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(26)),1fr))] gap-2 rounded-lg border bg-skrum-canvas p-2"
                        >
                            {value.map((column, index) => (
                                <ColumnTile
                                    key={column.id}
                                    column={column}
                                    index={index}
                                    total={value.length}
                                    selected={column.id === selected?.id}
                                    grabbed={grab?.id === column.id}
                                    invalid={
                                        errors[`columns.${index}.title`] !==
                                        undefined
                                    }
                                    registerTitle={registerTitle}
                                    onSelect={() => setSelectedId(column.id)}
                                    onTitleChange={(title) =>
                                        onChange(
                                            value.map((item) =>
                                                item.id === column.id
                                                    ? { ...item, title }
                                                    : item,
                                            ),
                                        )
                                    }
                                    onHandleKeyDown={(event) =>
                                        handleKeyDown(event, column)
                                    }
                                    onHandleBlur={() => {
                                        if (grab?.id === column.id) {
                                            setGrab(null);
                                        }
                                    }}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
            )}
            {full && (
                <p className="text-xs text-muted-foreground">
                    {t('A board has at most :count columns.', { count: max })}
                </p>
            )}
            {selected !== undefined && (
                <div
                    data-slot="retro-column-options"
                    className="grid *:col-start-1 *:row-start-1"
                >
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={value.length <= 1}
                        aria-label={t('Delete column “:title”', {
                            title:
                                selected.title.trim() === ''
                                    ? t('Untitled')
                                    : selected.title,
                        })}
                        onClick={removeSelected}
                        className="z-10 -mt-1.5 self-start justify-self-end bg-popover text-skrum-destructive-text hover:bg-skrum-destructive-soft hover:text-skrum-destructive-text"
                    >
                        <Trash2 aria-hidden />
                        <span>{t('Delete column')}</span>
                    </Button>
                    <ColumnColorOptions
                        value={selected.color}
                        colors={colors}
                        usedBy={usedBy}
                        columnTitle={selected.title}
                        onValueChange={(color) =>
                            onChange(
                                swapColumnColor(
                                    value,
                                    selectedIndex,
                                    color,
                                ) as DraftColumn[],
                            )
                        }
                    />
                </div>
            )}
            {columnErrors.map(([field, message]) => (
                <p
                    key={field}
                    role="alert"
                    className="text-xs text-skrum-destructive-text"
                >
                    {message}
                </p>
            ))}
            <span
                role="status"
                aria-live="assertive"
                data-slot="columns-announcement"
                className="sr-only"
            >
                {announcement}
            </span>
        </div>
    );
}

function titleOf(columns: DraftColumn[], id: string, untitled: string): string {
    const title = columns.find((column) => column.id === id)?.title ?? '';

    return title.trim() === '' ? untitled : title;
}
