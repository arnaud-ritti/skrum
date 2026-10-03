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
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { SurveyQuestionPayload } from '@/lib/surveys/types';
import { cn } from '@/lib/utils';

type Grab = { id: string; origin: string[] };

const moveSteps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 };

type BuilderQuestionListProps = {
    questions: SurveyQuestionPayload[];
    /** Questions move only in a draft that is not a health check. */
    sortable: boolean;
    renderCard: (
        question: SurveyQuestionPayload,
        index: number,
        handle: ReactNode,
    ) => ReactNode;
    onReorder: (ids: string[]) => void;
};

type SortableRowProps = {
    question: SurveyQuestionPayload;
    index: number;
    grabbed: boolean;
    renderCard: BuilderQuestionListProps['renderCard'];
    onHandleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
    onHandleBlur: () => void;
};

function SortableRow({
    question,
    index,
    grabbed,
    renderCard,
    onHandleKeyDown,
    onHandleBlur,
}: SortableRowProps) {
    const { t } = useTrans();
    const {
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: question.id });

    const handle = (
        <button
            ref={setActivatorNodeRef}
            type="button"
            {...listeners}
            aria-roledescription={t('sortable')}
            aria-pressed={grabbed ? true : undefined}
            aria-label={t('Reorder question :number', { number: index + 1 })}
            onKeyDown={onHandleKeyDown}
            onBlur={onHandleBlur}
            className="grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing aria-pressed:text-foreground"
        >
            <GripVertical aria-hidden className="size-4" />
        </button>
    );

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={cn(
                'min-w-0 rounded-xl motion-reduce:transition-none',
                (isDragging || grabbed) && 'shadow-drag',
            )}
        >
            {renderCard(question, index, handle)}
        </li>
    );
}

function titleOf(questions: SurveyQuestionPayload[], id: string): string {
    return questions.find((question) => question.id === id)?.label ?? '';
}

/**
 * The questions in their order. In a draft they move with the grip: by
 * pointer, or Space then the arrows then Space (Escape puts the question
 * back); the new order is given once, when the question is dropped.
 */
export function BuilderQuestionList({
    questions,
    sortable,
    renderCard,
    onReorder,
}: BuilderQuestionListProps) {
    const { t } = useTrans();
    const [grab, setGrab] = useState<Grab | null>(null);
    const [order, setOrder] = useState<string[] | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    );
    const ids = order ?? questions.map((question) => question.id);
    const byId = new Map(questions.map((question) => [question.id, question]));
    const shown = ids
        .map((id) => byId.get(id))
        .filter(
            (question): question is SurveyQuestionPayload =>
                question !== undefined,
        );
    const latest = useRef(ids);

    latest.current = ids;

    const describe = (current: string[], id: string) => ({
        title: titleOf(questions, id),
        position: current.indexOf(id) + 1,
        total: current.length,
    });

    const drop = (id: string): void => {
        const current = latest.current;
        const moved = grab !== null && current.join() !== grab.origin.join();

        setGrab(null);
        setOrder(null);
        setAnnouncement(
            t(
                '“:title” dropped at position :position of :total',
                describe(current, id),
            ),
        );

        if (moved) {
            onReorder(current);
        }
    };

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
            setOrder(null);
            setGrab(null);
            setAnnouncement(
                t(
                    'Move cancelled, “:title” back at position :position of :total',
                    describe(grab.origin, grab.id),
                ),
            );
        }

        window.addEventListener('keydown', cancelOnEscape, true);

        return () =>
            window.removeEventListener('keydown', cancelOnEscape, true);
    });

    const handleKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        id: string,
    ): void => {
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();

            if (grab?.id === id) {
                drop(id);

                return;
            }

            setGrab({ id, origin: latest.current });
            setAnnouncement(
                t(
                    'Picked up “:title”, position :position of :total',
                    describe(latest.current, id),
                ),
            );

            return;
        }

        if (grab?.id !== id || !(event.key in moveSteps)) {
            return;
        }

        event.preventDefault();

        const from = latest.current.indexOf(id);
        const to = from + moveSteps[event.key];

        if (to < 0 || to >= latest.current.length) {
            return;
        }

        const moved = arrayMove(latest.current, from, to);

        setOrder(moved);
        setAnnouncement(
            t(
                '“:title” moved to position :position of :total',
                describe(moved, id),
            ),
        );
    };

    const handleDragEnd = ({ active, over }: DragEndEvent): void => {
        if (over === null || active.id === over.id) {
            return;
        }

        const from = ids.indexOf(String(active.id));
        const to = ids.indexOf(String(over.id));

        if (from === -1 || to === -1) {
            return;
        }

        onReorder(arrayMove(ids, from, to));
    };

    if (!sortable) {
        return (
            <ol className="flex min-w-0 flex-col gap-3">
                {questions.map((question, index) => (
                    <li key={question.id} className="min-w-0">
                        {renderCard(question, index, null)}
                    </li>
                ))}
            </ol>
        );
    }

    return (
        <>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={ids}
                    strategy={verticalListSortingStrategy}
                >
                    <ol className="flex min-w-0 flex-col gap-3">
                        {shown.map((question, index) => (
                            <SortableRow
                                key={question.id}
                                question={question}
                                index={index}
                                grabbed={grab?.id === question.id}
                                renderCard={renderCard}
                                onHandleKeyDown={(event) =>
                                    handleKeyDown(event, question.id)
                                }
                                onHandleBlur={() => {
                                    if (grab?.id !== question.id) {
                                        return;
                                    }

                                    drop(question.id);
                                }}
                            />
                        ))}
                    </ol>
                </SortableContext>
            </DndContext>
            <span
                aria-live="assertive"
                data-slot="questions-announcement"
                className="sr-only"
            >
                {announcement}
            </span>
        </>
    );
}
