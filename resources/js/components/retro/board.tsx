import { useEffect, useState } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useHideMyCursor } from '@/components/session/cursor-preference';
import { SessionShell } from '@/components/session/session-shell';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRetroBoard } from '@/hooks/use-retro-board';
import { realtimeState } from '@/lib/realtime/realtime-state';
import type { Snapshot } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { ActionItemsPanel } from './action-items-panel';
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
import { CarriedActionItemsPanel } from './carried-action-items-panel';
import { ColumnsBoard } from './columns-board';
import { FacilitatorDock } from './facilitator-dock';
import {
    GroupNameSuggestionsProvider,
    SuggestGroupNamesButton,
} from './group-name-suggestions';
import { IcebreakerStage } from './icebreaker-stage';
import { PhaseHealth } from './phase-health';
import { PresentationOverlay } from './presentation-overlay';
import {
    CompletedPanelId,
    CompletedTabId,
    CompletedTabs,
    type CompletedView,
} from './results/completed-tabs';
import { ResultsView } from './results/results-view';
import { SuggestionsPanel } from './suggestions-panel';
import { AddSurveyButton } from './surveys-column';
import { VoteProgress } from './vote-progress';

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
