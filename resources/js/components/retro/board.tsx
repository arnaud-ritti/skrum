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
import { createPortal } from 'react-dom';
import CardGroupsController from '@/actions/App/Http/Controllers/Retros/CardGroupsController';
import CardPositionsController from '@/actions/App/Http/Controllers/Retros/CardPositionsController';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useHideMyCursor } from '@/components/session/cursor-preference';
import { SessionShell } from '@/components/session/session-shell';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRetroBoard } from '@/hooks/use-retro-board';
import { useTrans } from '@/hooks/use-trans';
import { realtimeState } from '@/lib/realtime/realtime-state';
import { retroRequest } from '@/lib/retro/api';
import { topLevelCards } from '@/lib/retro/board-reducer';
import type { CardPayload, Snapshot } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { ActionItemsPanel } from './action-items-panel';
import { AddColumn } from './add-column';
import {
    BoardProvider,
    useBoard,
    type BoardContextValue,
} from './board-context';
import { BoardCursors } from './board-cursors';
import { BoardEnded } from './board-ended';
import {
    BoardActions,
    BoardPhases,
    BoardPresence,
    BoardTimer,
    BoardTitle,
} from './board-topbar';
import { CarriedActionItemsPanel } from './carried-action-items-panel';
import { ColumnEditPhases } from './column-header';
import { parseDndId, useDragAccessibility } from './dnd';
import { FacilitatorDock } from './facilitator-dock';
import {
    GroupNameSuggestionsProvider,
    SuggestGroupNamesButton,
} from './group-name-suggestions';
import { HealthCheckPanel } from './health-check-panel';
import { IcebreakerStage } from './icebreaker-stage';
import { PresentationOverlay } from './presentation-overlay';
import {
    CompletedPanelId,
    CompletedTabId,
    CompletedTabs,
    type CompletedView,
} from './results/completed-tabs';
import { ResultsView } from './results/results-view';
import { CardPreview } from './retro-card';
import { RetroColumn } from './retro-column';
import { SuggestionsPanel } from './suggestions-panel';
import { AddSurveyButton, SurveysColumn } from './surveys-column';
import { VoteProgress } from './vote-progress';

/**
 * The columns, as every phase from Writing to Discussing shows them, and the
 * Board tab of a completed retro.
 */
function BoardColumns({ hideMyCursor }: { hideMyCursor: boolean }) {
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
            <div
                ref={setBoardElement}
                data-slot="retro-columns"
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
                    ColumnEditPhases.includes(board.retro.phase) && (
                        <AddColumn />
                    )}
                <BoardCursors container={boardElement} hidden={hideMyCursor} />
            </div>
            {/* Outside the frame's <main>: the preview must not be clipped by the scrolling board. */}
            {createPortal(
                <DragOverlay>
                    {activeCard ? (
                        <CardPreview
                            card={activeCard}
                            width={activeCardWidth}
                        />
                    ) : null}
                </DragOverlay>,
                document.body,
            )}
        </DndContext>
    );
}

/**
 * What the old board header held beside the chrome, until the task of each
 * phase gives it its place: vote progress (R8), carried action items (R10),
 * group name suggestions (R7), "Add survey" (S1).
 */
function PhaseTools() {
    const { board } = useBoard();

    return (
        <div
            data-slot="retro-phase-tools"
            className="flex flex-wrap items-center gap-3 px-4 pt-3 empty:hidden"
        >
            {board.retro.phase === 'voting' && <VoteProgress />}
            <CarriedActionItemsPanel />
            <SuggestGroupNamesButton />
            <AddSurveyButton />
        </div>
    );
}

function BoardBody({ hideMyCursor }: { hideMyCursor: boolean }) {
    const { board } = useBoard();
    const [completedView, setCompletedView] =
        useState<CompletedView>('results');
    const [trackedPhase, setTrackedPhase] = useState(board.retro.phase);
    const { phase } = board.retro;

    if (trackedPhase !== phase) {
        setTrackedPhase(phase);
        setCompletedView('results');
    }

    if (phase === 'completed' && completedView === 'results') {
        return (
            <>
                <CompletedTabs
                    value={completedView}
                    onChange={setCompletedView}
                />
                <div
                    role="tabpanel"
                    id={CompletedPanelId}
                    aria-labelledby={CompletedTabId('results')}
                    className="flex flex-1 flex-col"
                >
                    <ResultsView />
                </div>
            </>
        );
    }

    if (phase === 'icebreaker') {
        return <IcebreakerStage hideMyCursor={hideMyCursor} />;
    }

    return (
        <>
            {phase === 'health_check' && <HealthCheckPanel />}
            {phase === 'completed' && (
                <CompletedTabs
                    value={completedView}
                    onChange={setCompletedView}
                />
            )}
            <div
                {...(phase === 'completed' && {
                    role: 'tabpanel',
                    id: CompletedPanelId,
                    'aria-labelledby': CompletedTabId('board'),
                })}
                className="flex flex-1 flex-col lg:flex-row"
            >
                <BoardColumns hideMyCursor={hideMyCursor} />
                {phase === 'discussing' && (
                    <>
                        <SuggestionsPanel />
                        <ActionItemsPanel />
                    </>
                )}
            </div>
        </>
    );
}

export function Board({ snapshot }: { snapshot: Snapshot }) {
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
        connected,
        reconnecting,
        sessionExpired,
        subscribeGameEvents,
    } = useRetroBoard(snapshot);
    const isMobile = useIsMobile();
    const [hideMyCursor, setHideMyCursor] = useHideMyCursor();
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
        return (
            <BoardEnded
                reason={status}
                title={board.retro.title}
                teamUrl={board.links.team}
            />
        );
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
        subscribeGameEvents,
    };

    const isCompleted = board.retro.phase === 'completed';
    // Below md the header has no room for the facilitator's timer controls:
    // the whole timer sits in the facilitator bar.
    const timerInDock = isMobile && board.viewer.isFacilitator && !isCompleted;

    return (
        <BoardProvider value={ctx}>
            <GroupNameSuggestionsProvider>
                <SessionShell
                    kind="retro"
                    title={<BoardTitle />}
                    phases={isMobile ? undefined : <BoardPhases />}
                    timer={
                        timerInDock ? undefined : (
                            <BoardTimer controls={!isMobile} />
                        )
                    }
                    presence={<BoardPresence />}
                    actions={
                        <BoardActions
                            hideMyCursor={hideMyCursor}
                            onHideMyCursorChange={setHideMyCursor}
                            mobile={isMobile}
                        />
                    }
                    realtime={realtimeState(connected, online)}
                    connection={{ reconnecting, expired: sessionExpired }}
                >
                    <div className="flex h-full min-h-0 flex-col">
                        {isMobile && (
                            <div
                                data-slot="retro-subheader"
                                className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-4 py-2 *:min-w-0"
                            >
                                <div className="min-w-0 flex-1">
                                    <BoardPhases mobile />
                                </div>
                                {board.viewer.isGuest && <LanguageSwitcher />}
                            </div>
                        )}
                        <div
                            data-slot="retro-body"
                            className={cn(
                                'bg-dotgrid flex min-h-0 flex-1 flex-col overflow-y-auto',
                                !isCompleted && 'pb-32',
                            )}
                        >
                            <PhaseTools />
                            <BoardBody hideMyCursor={hideMyCursor} />
                        </div>
                    </div>
                    <FacilitatorDock
                        start={timerInDock ? <BoardTimer /> : undefined}
                    />
                </SessionShell>
                <PresentationOverlay />
            </GroupNameSuggestionsProvider>
        </BoardProvider>
    );
}
