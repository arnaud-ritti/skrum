import { useEffect, useState } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useHideMyCursor } from '@/components/session/cursor-preference';
import { SessionShell } from '@/components/session/session-shell';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRetroBoard } from '@/hooks/use-retro-board';
import { realtimeState } from '@/lib/realtime/realtime-state';
import type { RetroPhase, Snapshot } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import {
    BoardProvider,
    useBoard,
    type BoardContextValue,
} from './board-context';
import { BoardEnded } from './board-ended';
import {
    BoardActions,
    BoardPhases,
    BoardPresence,
    BoardTimer,
    BoardTitle,
} from './board-topbar';
import { CarriedItemsSheet } from './carried-items-sheet';
import { ColumnsBoard } from './columns-board';
import { FacilitatorDock } from './facilitator-dock';
import { GroupNameSuggestionsProvider, SuggestGroupNames } from './board-group';
import { IcebreakerStage } from './icebreaker-stage';
import {
    DiscussionProvider,
    PhaseDiscussing,
    PresentationOverlay,
} from './phase-discussing';
import { PhaseActions } from './phase-actions';
import { PhaseHealth } from './phase-health';
import {
    CompletedPanelId,
    CompletedTabId,
    CompletedTabs,
    type CompletedView,
} from './results/completed-tabs';
import { ResultsView } from './results/results-view';
import { AddSurveyButton } from './surveys-column';

/**
 * Grouping has its own banner for the suggestions; in Actions the groups are
 * no longer on screen.
 */
const WithoutGroupNameTool: RetroPhase[] = ['grouping', 'actions'];

/**
 * What the old board header held beside the chrome, until the task of each
 * phase gives it its place: "Add survey" (S1). The carried action items
 * have no mockup: their button stays here on every phase.
 * Group name suggestions outside Grouping stay here: Voting and Discussing
 * have no banner of their own for them.
 */
function PhaseTools() {
    const { board } = useBoard();

    return (
        <div
            data-slot="retro-phase-tools"
            className="flex flex-wrap items-center gap-3 px-4 pt-3 empty:hidden"
        >
            <CarriedItemsSheet />
            {!WithoutGroupNameTool.includes(board.retro.phase) && (
                <SuggestGroupNames />
            )}
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

    if (phase === 'discussing') {
        return <PhaseDiscussing hideMyCursor={hideMyCursor} />;
    }

    if (phase === 'actions') {
        return <PhaseActions hideMyCursor={hideMyCursor} />;
    }

    return (
        <>
            {phase === 'health_check' && <PhaseHealth />}
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
                <ColumnsBoard hideMyCursor={hideMyCursor} />
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
                <DiscussionProvider>
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
                                    {board.viewer.isGuest && (
                                        <LanguageSwitcher />
                                    )}
                                </div>
                            )}
                            <div
                                data-slot="retro-body"
                                className={cn(
                                    'bg-dotgrid flex min-h-0 flex-1 flex-col overflow-y-auto',
                                    !isCompleted && 'pb-32',
                                    // Wide, the columns of the discussion
                                    // scroll on their own and clear the dock
                                    // themselves.
                                    board.retro.phase === 'discussing' &&
                                        'xl:pb-0',
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
                </DiscussionProvider>
            </GroupNameSuggestionsProvider>
        </BoardProvider>
    );
}
