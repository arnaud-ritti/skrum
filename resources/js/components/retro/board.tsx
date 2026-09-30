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
import { useLocalPreference } from '@/hooks/use-local-preference';
import { useRetroBoard } from '@/hooks/use-retro-board';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { topLevelCards } from '@/lib/retro/board-reducer';
import type { CardPayload, Snapshot } from '@/lib/retro/types';
import { ActionItemsPanel } from './action-items-panel';
import { AddColumn } from './add-column';
import { BoardEnded } from './board-ended';
import { BoardHeader } from './board-header';
import { ColumnEditPhases } from './column-header';
import { ConnectionBanner } from './connection-banner';
import { BoardProvider, type BoardContextValue } from './board-context';
import { parseDndId, useDragAccessibility } from './dnd';
import { FlyingReactions } from './flying-reactions';
import { HideMyCursorKey, LiveCursorLayer } from './live-cursor-layer';
import { PhasePanel } from './phase-panel';
import { PresentationOverlay } from './presentation-overlay';
import { CardPreview } from './retro-card';
import { RetroColumn } from './retro-column';
import { CompletedTabs, type CompletedView } from './results/completed-tabs';
import { ResultsView } from './results/results-view';
import { SessionExpiredBanner } from './session-expired-banner';
import { VoteProgress } from './vote-progress';
import { SurveysColumn } from './surveys-column';

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
        invalidateSurvey,
        status,
        online,
        presence,
        unreadCardIds,
        markCommentsRead,
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
    const [activeCardWidth, setActiveCardWidth] = useState<number>();
    const [completedView, setCompletedView] =
        useState<CompletedView>('results');
    const [trackedPhase, setTrackedPhase] = useState(board.retro.phase);
    const [boardElement, setBoardElement] = useState<HTMLElement | null>(null);
    const [hideMyCursor, setHideMyCursor] = useLocalPreference(
        HideMyCursorKey,
        false,
    );
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

    if (trackedPhase !== board.retro.phase) {
        setTrackedPhase(board.retro.phase);
        setCompletedView('results');
    }

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
        invalidateSurvey,
        sessionExpired,
        online,
        presence,
        isEditable: !board.retro.isLocked,
        unreadCardIds,
        markCommentsRead,
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
                        hideMyCursor={hideMyCursor}
                        onHideMyCursorChange={setHideMyCursor}
                        actions={
                            board.retro.phase === 'voting' ? (
                                <VoteProgress />
                            ) : undefined
                        }
                    />
                    <ConnectionBanner reconnecting={reconnecting} />
                    <div className="flex flex-1 flex-col lg:min-h-0">
                        <PhasePanel />
                        {board.retro.phase === 'completed' && (
                            <CompletedTabs
                                value={completedView}
                                onChange={setCompletedView}
                            />
                        )}
                        {board.retro.phase === 'completed' &&
                        completedView === 'results' ? (
                            <ResultsView />
                        ) : (
                            <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
                                <DndContext
                                    id="retro-board"
                                    sensors={sensors}
                                    accessibility={dragAccessibility}
                                    collisionDetection={closestCenter}
                                    onDragStart={(event) => {
                                        setActiveCardId(
                                            parseDndId(event.active.id)?.id ??
                                                null,
                                        );
                                        setActiveCardWidth(
                                            event.active.rect.current.initial
                                                ?.width,
                                        );
                                    }}
                                    onDragCancel={() => setActiveCardId(null)}
                                    onDragEnd={(event) =>
                                        void handleDragEnd(event)
                                    }
                                >
                                    <main
                                        ref={setBoardElement}
                                        className="relative flex min-w-0 flex-1 items-start gap-4 overflow-x-auto p-4"
                                    >
                                        <SurveysColumn />
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
                                            ColumnEditPhases.includes(
                                                board.retro.phase,
                                            ) && <AddColumn />}
                                        <LiveCursorLayer
                                            container={boardElement}
                                            hidden={hideMyCursor}
                                        />
                                    </main>
                                    <DragOverlay>
                                        {activeCard ? (
                                            <CardPreview
                                                card={activeCard}
                                                width={activeCardWidth}
                                            />
                                        ) : null}
                                    </DragOverlay>
                                </DndContext>
                                {board.retro.phase === 'discussing' && (
                                    <ActionItemsPanel />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <FlyingReactions />
            <PresentationOverlay />
        </BoardProvider>
    );
}
