import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useEffect, type Dispatch } from 'react';
import CardGroupsController from '@/actions/App/Http/Controllers/Retros/CardGroupsController';
import CardPositionsController from '@/actions/App/Http/Controllers/Retros/CardPositionsController';
import { useRetroBoard } from '@/hooks/use-retro-board';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { topLevelCards, type BoardAction } from '@/lib/retro/board-reducer';
import type { CardPayload, Snapshot } from '@/lib/retro/types';
import { BoardEnded } from './board-ended';
import { BoardHeader } from './board-header';
import { ConnectionBanner } from './connection-banner';
import { parseDndId } from './dnd';
import { RetroColumn } from './retro-column';
import { VoteProgress } from './vote-progress';

export type BoardContextValue = {
    board: Snapshot;
    dispatch: Dispatch<BoardAction>;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    refetch: () => Promise<void>;
};

export function Board({ snapshot }: { snapshot: Snapshot }) {
    const { t } = useTrans();
    const { board, dispatch, run, refetch, status, online, reconnecting } =
        useRetroBoard(snapshot);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const highlightedCardId = board.retro.highlightedCardId;

    useEffect(() => {
        if (!highlightedCardId) {
            return;
        }

        document.getElementById(`card-${highlightedCardId}`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
        });
    }, [highlightedCardId]);

    if (status !== 'active') {
        return <BoardEnded reason={status} teamUrl={board.links.team} />;
    }

    const ctx: BoardContextValue = { board, dispatch, run, refetch };

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        const dragged = parseDndId(active.id);
        const target = parseDndId(over?.id);

        if (!dragged || !target || dragged.kind !== 'card') {
            return;
        }

        if (target.kind === 'card' && target.id === dragged.id) {
            return;
        }

        const retroId = board.retro.id;

        if (
            board.retro.phase === 'grouping' &&
            target.kind === 'card' &&
            target.id !== dragged.id
        ) {
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
                dispatch({ type: 'cards.upsert', cards: response.cards });
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

        const siblings = topLevelCards(board.cards, columnId).filter(
            (card) => card.id !== dragged.id,
        );
        const columnCards = topLevelCards(board.cards, columnId);
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
            dispatch({ type: 'cards.upsert', cards: response.cards });
        }
    };

    return (
        <div className="flex min-h-dvh flex-col">
            <BoardHeader
                ctx={ctx}
                online={online}
                actions={
                    board.retro.phase === 'voting' ? (
                        <VoteProgress board={board} />
                    ) : undefined
                }
            />
            <ConnectionBanner reconnecting={reconnecting} />
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => void handleDragEnd(event)}
            >
                <main className="flex flex-1 items-start gap-4 overflow-x-auto p-4">
                    {board.columns.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            {t('No columns yet.')}
                        </p>
                    )}
                    {board.columns.map((column) => (
                        <RetroColumn
                            key={column.id}
                            column={column}
                            ctx={ctx}
                        />
                    ))}
                </main>
            </DndContext>
        </div>
    );
}
