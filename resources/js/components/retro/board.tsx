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
import { useEffect, useState } from 'react';
import CardGroupsController from '@/actions/App/Http/Controllers/Retros/CardGroupsController';
import CardPositionsController from '@/actions/App/Http/Controllers/Retros/CardPositionsController';
import { useRetroBoard } from '@/hooks/use-retro-board';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { topLevelCards } from '@/lib/retro/board-reducer';
import type { CardPayload, Snapshot } from '@/lib/retro/types';
import { ActionItemsPanel } from './action-items-panel';
import { AddColumn } from './add-column';
import { BoardEnded } from './board-ended';
import { BoardHeader } from './board-header';
import { CompletedSummary } from './completed-summary';
import { ConnectionBanner } from './connection-banner';
import { BoardProvider, type BoardContextValue } from './board-context';
import { parseDndId, useDragAccessibility } from './dnd';
import { CardPreview } from './retro-card';
import { RetroColumn } from './retro-column';
import { SessionExpiredBanner } from './session-expired-banner';
import { VoteProgress } from './vote-progress';

export function Board({ snapshot }: { snapshot: Snapshot }) {
    const { t } = useTrans();
    const {
        board,
        dispatch,
        apply,
        run,
        handleError,
        hasActiveCard,
        refetch,
        status,
        online,
        reconnecting,
        sessionExpired,
    } = useRetroBoard(snapshot);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const dragAccessibility = useDragAccessibility(board);
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

    const ctx: BoardContextValue = {
        board,
        dispatch,
        apply,
        run,
        handleError,
        hasActiveCard,
        refetch,
        sessionExpired,
    };

    const activeCard =
        board.cards.find((card) => card.id === activeCardId) ?? null;

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
            apply({ type: 'cards.upsert', cards: response.cards });
        }
    };

    return (
        <BoardProvider value={ctx}>
            <div className="flex min-h-dvh flex-col">
                {sessionExpired && <SessionExpiredBanner />}
                <div className="flex flex-1 flex-col" inert={sessionExpired}>
                    <BoardHeader
                        online={online}
                        actions={
                            board.retro.phase === 'voting' ? (
                                <VoteProgress board={board} />
                            ) : undefined
                        }
                    />
                    <ConnectionBanner reconnecting={reconnecting} />
                    <div className="flex flex-1 flex-col lg:min-h-0">
                        {board.retro.phase === 'completed' && (
                            <CompletedSummary board={board} />
                        )}
                        <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
                            <DndContext
                                id="retro-board"
                                sensors={sensors}
                                accessibility={dragAccessibility}
                                collisionDetection={closestCenter}
                                onDragStart={(event) =>
                                    setActiveCardId(
                                        parseDndId(event.active.id)?.id ?? null,
                                    )
                                }
                                onDragCancel={() => setActiveCardId(null)}
                                onDragEnd={(event) => void handleDragEnd(event)}
                            >
                                <main className="flex min-w-0 flex-1 items-start gap-4 overflow-x-auto p-4">
                                    {board.columns.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            {t('No columns yet.')}
                                        </p>
                                    )}
                                    {board.columns.map((column, index) => (
                                        <RetroColumn
                                            key={column.id}
                                            column={column}
                                            index={index}
                                        />
                                    ))}
                                    {board.viewer.isFacilitator &&
                                        board.retro.phase === 'writing' && (
                                            <AddColumn />
                                        )}
                                </main>
                                <DragOverlay>
                                    {activeCard ? (
                                        <CardPreview card={activeCard} />
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                            {board.retro.phase === 'discussing' && (
                                <ActionItemsPanel />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </BoardProvider>
    );
}
