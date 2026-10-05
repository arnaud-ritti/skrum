import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { IcebreakerStage } from '@/components/games/icebreaker-stage';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useHideMyCursor } from '@/components/session/cursor-preference';
import { SessionShell } from '@/components/session/session-shell';
import { useIsMobile } from '@/hooks/use-mobile';
import { ActivityProvider } from '@/hooks/use-retro-activity';
import { useRetroBoard } from '@/hooks/use-retro-board';
import { realtimeState } from '@/lib/realtime/realtime-state';
import { isBoardEditable, isObserving } from '@/lib/retro/adapters';
import type { RetroPhase, Snapshot } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import {
    BoardContext,
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
    boardSelf,
} from './board-topbar';
import { BulkExport } from './bulk-export-dialog';
import { CarriedItemsSheet } from './carried-items-sheet';
import { ColumnsBoard } from './columns-board';
import { FacilitatorDock } from './facilitator-dock';
import { GroupNameSuggestionsProvider, SuggestGroupNames } from './board-group';
import { DiscussionProvider, PhaseDiscussing } from './phase-discussing';
import { PhaseActions } from './phase-actions';
import { PhaseRoti } from './phase-roti';
import { useRotiFacilitation } from './roti-facilitation';
import { SessionEnd, type CompletedView } from './session-end';
import {
    DiscussionEstimate,
    DiscussionPace,
    TopicMeta,
    TopicTime,
} from './topic-meta';
import {
    ItemTopic,
    LinkedActionCount,
    QuickAddLink,
    TopicActions,
} from './topic-actions';
import { TopicNotes } from './topic-notes';
import { TopicTimer } from './topic-timer';

/**
 * Grouping has its own banner for the suggestions; in Actions and ROTI the
 * groups are no longer on screen.
 */
const WithoutGroupNameTool: RetroPhase[] = ['grouping', 'actions', 'roti'];

/**
 * What the old board header held beside the chrome. The carried action items
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
        </div>
    );
}

function BoardBody({ hideMyCursor }: { hideMyCursor: boolean }) {
    const { board } = useBoard();
    const [completedView, setCompletedView] =
        useState<CompletedView>('results');
    const [trackedPhase, setTrackedPhase] = useState(board.retro.phase);
    const [celebrates, setCelebrates] = useState(false);
    const { phase } = board.retro;

    if (trackedPhase !== phase) {
        setTrackedPhase(phase);
        setCompletedView('results');
        // Only who sees the session end live gets the confetti: a board
        // opened once completed never passes here.
        setCelebrates(phase === 'completed');
    }

    if (phase === 'completed') {
        return (
            <SessionEnd
                view={completedView}
                onViewChange={setCompletedView}
                celebrates={celebrates}
            >
                <ColumnsBoard hideMyCursor={hideMyCursor} />
            </SessionEnd>
        );
    }

    if (phase === 'icebreaker') {
        return <IcebreakerStage hideMyCursor={hideMyCursor} />;
    }

    if (phase === 'discussing') {
        return (
            <PhaseDiscussing
                hideMyCursor={hideMyCursor}
                timer={<TopicTimer />}
                notes={<TopicNotes />}
                actions={<TopicActions />}
                topicMeta={(topic) => <TopicMeta topic={topic} />}
                estimate={<DiscussionEstimate />}
                summary={<DiscussionPace />}
                upNextEstimate={<TopicTime />}
            />
        );
    }

    if (phase === 'actions') {
        return (
            <PhaseActions
                hideMyCursor={hideMyCursor}
                exportAll={<BulkExport />}
                topicMeta={(topic) => <LinkedActionCount topic={topic} />}
                linkedTo={(topic) => <QuickAddLink topic={topic} />}
                itemTopic={(item) => <ItemTopic item={item} />}
            />
        );
    }

    if (phase === 'roti') {
        return <PhaseRoti />;
    }

    return (
        <div className="flex flex-1 flex-col lg:flex-row">
            <ColumnsBoard hideMyCursor={hideMyCursor} />
        </div>
    );
}

/** The facilitator's bar, with the ROTI phase's nudge and reveal (RT-9). */
function BoardDock({ start }: { start?: ReactNode }) {
    return <FacilitatorDock start={start} roti={useRotiFacilitation()} />;
}

export function Board({ snapshot }: { snapshot: Snapshot }) {
    const { status, connected, reconnecting, ...rest } =
        useRetroBoard(snapshot);
    const { board, online, sessionExpired } = rest;
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
        ...rest,
        isEditable: isBoardEditable(board),
    };

    const isCompleted = board.retro.phase === 'completed';
    // In Discussing the timer is the topic's, on the stage, and nowhere else
    // (P21-07).
    const timerOnStage = board.retro.phase === 'discussing';
    // Below md the header has no room for the facilitator's timer controls:
    // the whole timer sits in the facilitator bar.
    const timerInDock =
        isMobile && board.viewer.isFacilitator && !isCompleted && !timerOnStage;

    return (
        <BoardContext value={ctx}>
            <ActivityProvider>
                <GroupNameSuggestionsProvider>
                    <DiscussionProvider>
                        <SessionShell
                            kind="retro"
                            observing={isObserving(board)}
                            self={boardSelf(board)}
                            title={<BoardTitle />}
                            phases={isMobile ? undefined : <BoardPhases />}
                            timer={
                                timerInDock || timerOnStage ? undefined : (
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
                            connection={{
                                reconnecting,
                                expired: sessionExpired,
                            }}
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
                                        // Clears the reaction bar, and the
                                        // facilitator bar above it.
                                        !isCompleted &&
                                            (board.viewer.isFacilitator
                                                ? 'pb-40'
                                                : 'pb-32'),
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
                            <BoardDock
                                start={timerInDock ? <BoardTimer /> : undefined}
                            />
                        </SessionShell>
                    </DiscussionProvider>
                </GroupNameSuggestionsProvider>
            </ActivityProvider>
        </BoardContext>
    );
}
