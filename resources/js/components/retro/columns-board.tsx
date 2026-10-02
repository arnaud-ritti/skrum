import {
    closestCenter,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { EyeOff, Plus, SquarePen } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import CardGroupsController from '@/actions/App/Http/Controllers/Retros/CardGroupsController';
import CardPositionsController from '@/actions/App/Http/Controllers/Retros/CardPositionsController';
import ColumnsController from '@/actions/App/Http/Controllers/Retros/ColumnsController';
import { ColumnColorOptions } from '@/components/skrum/column-color-picker';
import { EmptyState } from '@/components/skrum/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { ColumnEditPhases, writingProgress } from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import { topLevelCards } from '@/lib/retro/board-reducer';
import type {
    BoardColumn as BoardColumnData,
    CardPayload,
    ColumnColor,
} from '@/lib/retro/types';
import { CardPreview } from './board-card';
import { BoardColumn } from './board-column';
import { useBoard } from './board-context';
import { BoardCursors } from './board-cursors';
import { GroupingBanner } from './board-group';
import { parseDndId, useDragAccessibility } from './dnd';
import { PhaseVotingBar } from './phase-voting-bar';
import { SurveysColumn } from './surveys-column';

const DefaultColor: ColumnColor = 'moss';

function AddColumnForm() {
    const ctx = useBoard();
    const { t } = useTrans();
    const [title, setTitle] = useState('');
    const [color, setColor] = useState<ColumnColor>(DefaultColor);
    const [sending, setSending] = useState(false);

    const submit = async () => {
        const trimmed = title.trim();

        if (trimmed === '' || sending) {
            return;
        }

        setSending(true);

        const response = await ctx.run(
            retroRequest<{ columns: BoardColumnData[] }>(
                ColumnsController.store(ctx.board.retro.id),
                { title: trimmed, color },
            ),
        );

        setSending(false);

        if (!response) {
            return;
        }

        ctx.apply({ type: 'columns.set', columns: response.columns });
        setTitle('');
        setColor(DefaultColor);
    };

    return (
        <form
            data-slot="retro-add-column"
            className="flex w-column max-w-full shrink-0 snap-start flex-col gap-3 rounded-xl border border-dashed border-input p-3"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <Input
                value={title}
                maxLength={100}
                required
                placeholder={t('Column title')}
                aria-label={t('Column title')}
                onChange={(event) => setTitle(event.target.value)}
            />
            <ColumnColorOptions
                value={color}
                onValueChange={setColor}
                columnTitle={title}
            />
            <Button
                type="submit"
                size="sm"
                className="max-w-full self-start"
                disabled={sending || title.trim() === ''}
            >
                <Plus aria-hidden />
                <span className="truncate">{t('Add column')}</span>
            </Button>
        </form>
    );
}

/**
 * The line above the columns in Writing: what silent writing means, and how
 * far the room is.
 */
export function WritingBanner({ typing }: { typing?: ReactNode }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { cards, written, present } = writingProgress(
        ctx.board,
        ctx.online.length,
    );

    return (
        <div
            data-slot="retro-writing-banner"
            className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 text-body-sm text-muted-foreground md:px-6"
        >
            <EyeOff className="size-4 shrink-0" aria-hidden />
            <p className="min-w-48 flex-1">
                {t(
                    'Silent writing: your cards are only visible to you until the reveal.',
                )}
            </p>
            {typing}
            <Badge
                variant="muted"
                shape="pill"
                data-slot="retro-writing-progress"
                className="max-w-full"
            >
                <SquarePen aria-hidden />
                <span className="truncate">
                    {cards === 1
                        ? t(':count card', { count: cards })
                        : t(':count cards', { count: cards })}
                    {' · '}
                    {t(':written/:present have written', { written, present })}
                </span>
            </Badge>
        </div>
    );
}

/**
 * The columns, as every phase from Writing to Voting shows them, and the
 * Board tab of a completed retro.
 */
export function ColumnsBoard({
    hideMyCursor,
    typing,
}: {
    hideMyCursor: boolean;
    /** Place of the typing indicator of the Writing banner (RT-1). */
    typing?: ReactNode;
}) {
    const { board, dispatch, apply, run } = useBoard();
    const { t } = useTrans();
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );
    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const [activeCardWidth, setActiveCardWidth] = useState<number>();
    const [boardElement, setBoardElement] = useState<HTMLElement | null>(null);
    const dragAccessibility = useDragAccessibility(board);
    const activeCard =
        board.cards.find((card) => card.id === activeCardId) ?? null;
    const activeColor =
        board.columns.find((column) => column.id === activeCard?.columnId)
            ?.color ?? DefaultColor;
    const { phase } = board.retro;
    const canAddColumn =
        board.viewer.isFacilitator && ColumnEditPhases.includes(phase);

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        setActiveCardId(null);

        const dragged = parseDndId(active.id);
        const target = parseDndId(over?.id);

        if (!dragged || !target || dragged.kind !== 'card') {
            return;
        }

        if (target.kind === 'card' && target.id === dragged.id) {
            return;
        }

        const retroId = board.retro.id;

        if (phase === 'grouping' && target.kind === 'card') {
            const response = await run(
                retroRequest<{ cards: CardPayload[] }>(
                    CardGroupsController.update({
                        retro: retroId,
                        card: dragged.id,
                    }),
                    { parent_card_id: target.id },
                ),
            );

            if (response) {
                apply({ type: 'cards.upsert', cards: response.cards });
            }

            return;
        }

        const targetCard =
            target.kind === 'card'
                ? board.cards.find((card) => card.id === target.id)
                : undefined;
        const columnId =
            target.kind === 'column' ? target.id : targetCard?.columnId;

        if (!columnId) {
            return;
        }

        const columnCards = topLevelCards(board.cards, columnId);
        const siblings = columnCards.filter((card) => card.id !== dragged.id);
        const draggedIndex = columnCards.findIndex(
            (card) => card.id === dragged.id,
        );
        const targetIndex = targetCard
            ? columnCards.findIndex((card) => card.id === targetCard.id)
            : -1;
        const movesDownWithinColumn =
            draggedIndex !== -1 && draggedIndex < targetIndex;
        const index = targetCard
            ? Math.max(
                  movesDownWithinColumn
                      ? targetIndex
                      : siblings.findIndex((card) => card.id === targetCard.id),
                  0,
              )
            : siblings.length;

        dispatch({ type: 'card.place', cardId: dragged.id, columnId, index });

        const response = await run(
            retroRequest<{ cards: CardPayload[] }>(
                CardPositionsController.update({
                    retro: retroId,
                    card: dragged.id,
                }),
                { column_id: columnId, index },
            ),
        );

        if (response) {
            apply({ type: 'cards.upsert', cards: response.cards });
        }
    };

    return (
        <DndContext
            id="retro-board"
            sensors={sensors}
            accessibility={dragAccessibility}
            collisionDetection={closestCenter}
            onDragStart={(event) => {
                const cardId = parseDndId(event.active.id)?.id ?? null;
                const cardElement =
                    cardId === null
                        ? null
                        : document.getElementById(`card-${cardId}`);

                setActiveCardId(cardId);
                setActiveCardWidth(cardElement?.getBoundingClientRect().width);
            }}
            onDragCancel={() => setActiveCardId(null)}
            onDragEnd={(event) => void handleDragEnd(event)}
        >
            <div className="flex min-w-0 flex-1 flex-col">
                {phase === 'writing' && <WritingBanner typing={typing} />}
                {phase === 'grouping' && <GroupingBanner />}
                {phase === 'voting' && <PhaseVotingBar />}
                <div
                    ref={setBoardElement}
                    data-slot="retro-columns"
                    className="relative flex min-w-0 flex-1 items-start gap-4 overflow-x-auto p-4 md:px-6 md:py-5"
                >
                    <SurveysColumn />
                    {board.columns.length === 0 && (
                        <EmptyState
                            module="retro"
                            illustration={false}
                            title={t('No columns yet.')}
                            description={
                                canAddColumn
                                    ? t('Add a column to start writing.')
                                    : t(
                                          'The facilitator has not added a column yet.',
                                      )
                            }
                        />
                    )}
                    {board.columns.map((column) => (
                        <BoardColumn key={column.id} column={column} />
                    ))}
                    {canAddColumn && <AddColumnForm />}
                    <BoardCursors
                        container={boardElement}
                        hidden={hideMyCursor}
                    />
                </div>
            </div>
            {/* Outside the frame's <main>: the preview must not be clipped by the scrolling board. */}
            {createPortal(
                <DragOverlay>
                    {activeCard ? (
                        <CardPreview
                            card={activeCard}
                            color={activeColor}
                            width={activeCardWidth}
                        />
                    ) : null}
                </DragOverlay>,
                document.body,
            )}
        </DndContext>
    );
}
