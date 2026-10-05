import {
    ArrowRight,
    Crown,
    Eye,
    EyeOff,
    Flag,
    Lock,
    LockOpen,
    Pause,
    Play,
    ScanEye,
    SkipBack,
    SkipForward,
    VenetianMask,
    Vote,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import RetroPhasesController from '@/actions/App/Http/Controllers/Retros/RetroPhasesController';
import RetroSettingsController from '@/actions/App/Http/Controllers/Retros/RetroSettingsController';
import { FacilitatorBar } from '@/components/skrum/facilitator-bar';
import type { FacilitatorAction } from '@/components/skrum/facilitator-bar';
import { detectPlatform } from '@/components/skrum/keyboard-shortcuts';
import { useCountdown, useServerOffset } from '@/hooks/use-countdown';
import { useHeightInRem } from '@/hooks/use-height-in-rem';
import { useIsMobile } from '@/hooks/use-mobile';
import { useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { nextPhase, PhaseLabels } from '@/lib/retro/phases';
import type { RetroPhase, Snapshot } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { BoardReactions } from './board-reactions';
import { useOptionalDiscussion } from './phase-discussing';
import { useTimerPause } from './use-timer-pause';

type Translate = (key: string) => string;

export type FacilitatorTools = {
    t: Translate;
    /** Sends one setting of the retro, as the settings popover does. */
    onSetting: (patch: Record<string, boolean>) => void;
    onPhase: (phase: RetroPhase) => void;
    busy?: boolean;
    /** How the key of the main button is written on this system: "⌘→" or "Ctrl+→". */
    phaseShortcut?: string;
    /** The same key for `aria-keyshortcuts`: "Meta+ArrowRight" or "Control+ArrowRight". */
    phaseKeyShortcuts?: string;
    /** The topics of the discussion: moving between them, and bringing everyone along. */
    topics?: {
        canPrevious: boolean;
        canNext: boolean;
        onStep: (offset: -1 | 1) => void;
        onFollow: (follows: boolean) => void;
    };
    /** The places of the ROTI phase a later plan fills (RT-9). */
    roti?: RotiTools;
    /** The retro's timer: "Pause" while it runs, "Resume" while paused (RT-2). */
    timer?: {
        paused: boolean;
        running: boolean;
        onPause: () => void;
        onResume: () => void;
    };
};

/**
 * "Nudge the last voters" and "Reveal ROTI" of the ROTI mockup (RT-9),
 * filled by `useRotiFacilitation`.
 */
export type RotiTools = {
    nudge?: FacilitatorAction;
    reveal?: FacilitatorAction;
};

type DockBoard = Pick<Snapshot, 'retro'>;

/**
 * The facilitator's actions of a phase (spec ruling 28): every action that
 * exists today has its slot. The lock is in the bar while cards are written,
 * grouped and voted; from Discussing on its slot is the settings popover,
 * as in the mockups. The completed state has no bar.
 */
export function facilitatorActions(
    phase: RetroPhase,
    board: DockBoard,
    tools: FacilitatorTools,
): FacilitatorAction[] {
    if (phase === 'completed') {
        return [];
    }

    const pause = pauseAction(phase, tools);
    const actions = phaseActions(phase, board, tools);

    return pause ? [pause, ...actions] : actions;
}

/**
 * "Pause" first, before "+2 min" (mockup order). The icebreaker's timer is
 * the game's round clock, never paused (spec §6.2).
 */
function pauseAction(
    phase: RetroPhase,
    { t, timer }: FacilitatorTools,
): FacilitatorAction | undefined {
    if (phase === 'icebreaker' || phase === 'completed') {
        return undefined;
    }

    if (!timer || (!timer.running && !timer.paused)) {
        return undefined;
    }

    return {
        id: 'pause',
        kind: 'toggle',
        label: timer.paused ? t('Resume') : t('Pause'),
        icon: timer.paused ? Play : Pause,
        pressed: timer.paused,
        onSelect: timer.paused ? timer.onResume : timer.onPause,
    };
}

function phaseActions(
    phase: RetroPhase,
    board: DockBoard,
    { t, onSetting, topics, roti }: FacilitatorTools,
): FacilitatorAction[] {
    const { retro } = board;

    const lock: FacilitatorAction = {
        id: 'lock',
        kind: 'toggle',
        label: retro.isLocked ? t('Board locked') : t('Lock board'),
        icon: retro.isLocked ? Lock : LockOpen,
        pressed: retro.isLocked,
        onSelect: () => onSetting({ is_locked: !retro.isLocked }),
    };

    if (phase === 'voting') {
        return [
            lock,
            // The "Hide vote counts" switch of the settings, named after what
            // a press does.
            {
                id: 'reveal-votes',
                label: retro.hideVoteCounts
                    ? t('Reveal the votes')
                    : t('Hide the votes'),
                icon: retro.hideVoteCounts ? Eye : EyeOff,
                onSelect: () =>
                    onSetting({ hide_vote_counts: !retro.hideVoteCounts }),
            },
        ];
    }

    if (phase === 'discussing') {
        // "Everyone follows" is the presentation mode of the settings.
        const follow: FacilitatorAction = {
            id: 'presentation',
            kind: 'toggle',
            label: t('Everyone follows'),
            icon: ScanEye,
            pressed: retro.presentationMode,
            onSelect: () =>
                topics
                    ? topics.onFollow(!retro.presentationMode)
                    : onSetting({ presentation_mode: !retro.presentationMode }),
        };

        if (!topics) {
            return [follow];
        }

        return [
            follow,
            {
                id: 'previous-topic',
                label: t('Previous topic'),
                icon: SkipBack,
                disabled: !topics.canPrevious,
                onSelect: () => topics.onStep(-1),
            },
            {
                id: 'next-topic',
                label: t('Next topic'),
                icon: SkipForward,
                disabled: !topics.canNext,
                onSelect: () => topics.onStep(1),
            },
        ];
    }

    if (phase === 'actions') {
        // The topic in focus is the highlighted card: a move takes everyone.
        return topics
            ? [
                  {
                      id: 'next-topic',
                      label: t('Next topic'),
                      icon: SkipForward,
                      disabled: !topics.canNext,
                      onSelect: () => topics.onStep(1),
                  },
              ]
            : [];
    }

    if (phase === 'roti') {
        return [roti?.nudge, roti?.reveal].filter(
            (action): action is FacilitatorAction => action !== undefined,
        );
    }

    return [lock];
}

function primaryLabel(
    phase: RetroPhase,
    target: RetroPhase,
    t: Translate,
): string {
    if (phase === 'icebreaker') {
        return t('Go to the retro');
    }

    // Actions says "Next phase" (ruling 26): the mockup closes the retro
    // from here, and the retro still has its ROTI to go through.
    if (phase === 'actions') {
        return t('Next phase');
    }

    return t(PhaseLabels[target]);
}

/**
 * The main button names the phase it leads to; the last phase ends the
 * session. The icebreaker is left for "the retro", whatever its first phase
 * (mockup ScreenIcebreaker).
 */
export function facilitatorPrimary(
    phase: RetroPhase,
    board: DockBoard,
    {
        t,
        onPhase,
        busy = false,
        phaseShortcut,
        phaseKeyShortcuts,
    }: FacilitatorTools,
): FacilitatorAction | undefined {
    const target = nextPhase(board.retro.phases, phase);

    if (target === null) {
        return undefined;
    }

    if (target === 'completed') {
        return {
            id: 'end-session',
            label: t('End session'),
            icon: Flag,
            disabled: busy,
            shortcut: phaseShortcut,
            ariaKeyShortcuts: phaseKeyShortcuts,
            onSelect: () => onPhase(target),
        };
    }

    return {
        id: 'next-phase',
        label: primaryLabel(phase, target, t),
        icon: ArrowRight,
        iconPosition: 'end',
        disabled: busy,
        shortcut: phaseShortcut,
        ariaKeyShortcuts: phaseKeyShortcuts,
        onSelect: () => onPhase(target),
    };
}

/**
 * "Anonymity: on" of the Writing mockup, or "off". A state, not a control:
 * anonymity is changed in the settings, where the rule that it cannot be
 * turned off after the first card is explained.
 */
function AnonymityState({
    isAnonymous,
    compact,
}: {
    isAnonymous: boolean;
    compact: boolean;
}) {
    const { t } = useTrans();

    return (
        <span
            data-slot="facilitator-anonymity"
            data-state={isAnonymous ? 'on' : 'off'}
            className="inline-flex h-8 min-w-0 shrink items-center gap-1.5 px-2 text-sm font-medium"
        >
            <VenetianMask className="size-4 shrink-0" aria-hidden />
            <span className={cn('truncate', compact && 'sr-only')}>
                {isAnonymous ? t('Anonymity: on') : t('Anonymity: off')}
            </span>
        </span>
    );
}

/**
 * "5 votes / person" of the Voting mockup. A state, not a control: the server
 * locks the vote limit once voting has started.
 */
function VoteLimitState({
    count,
    compact,
}: {
    count: number;
    compact: boolean;
}) {
    const { t } = useTrans();
    const label = t(
        count === 1 ? ':count vote / person' : ':count votes / person',
        { count },
    );

    return (
        <span
            data-slot="facilitator-vote-limit"
            className="inline-flex h-8 min-w-0 shrink items-center gap-1.5 px-2 text-sm font-medium"
        >
            <Vote className="size-4 shrink-0" aria-hidden />
            {compact && <span aria-hidden>{count}</span>}
            <span className={cn('truncate', compact && 'sr-only')}>
                {label}
            </span>
        </span>
    );
}

const DockBottomRem = 1.5;

/**
 * Bottom of the board: the reaction bar, and for the facilitator the bar of
 * the phase under it. The two never overlap (spec §6.4).
 */
export function FacilitatorDock({
    start,
    roti,
}: {
    start?: ReactNode;
    /** Places of "Nudge" and "Reveal ROTI" in the bar of the ROTI phase (RT-9). */
    roti?: RotiTools;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const [busy, setBusy] = useState(false);
    const [platform] = useState(detectPlatform);
    const [barRef, barHeight] = useHeightInRem();
    const discussion = useOptionalDiscussion();
    const timerPause = useTimerPause();
    const { board } = ctx;
    const { phase } = board.retro;
    const remaining = useCountdown(
        board.retro.timerEndsAt,
        useServerOffset(board.serverTime),
    );
    const hasBar = board.viewer.isFacilitator && phase !== 'completed';

    const send = async (request: Promise<unknown>) => {
        setBusy(true);

        const result = await ctx.run(request);

        if (result !== undefined) {
            await ctx.refetch();
        }

        setBusy(false);
    };

    const topicIndex =
        discussion?.topics.findIndex(
            (topic) => topic.id === discussion.current?.id,
        ) ?? -1;
    const topicCount = discussion?.topics.length ?? 0;

    const tools: FacilitatorTools = {
        t,
        busy,
        phaseShortcut: platform === 'mac' ? '⌘→' : 'Ctrl+→',
        phaseKeyShortcuts:
            platform === 'mac' ? 'Meta+ArrowRight' : 'Control+ArrowRight',
        roti,
        timer: {
            paused: board.retro.timerPausedSeconds !== null,
            running: remaining !== null && remaining > 0,
            onPause: () => void timerPause.pause(),
            onResume: () => void timerPause.resume(),
        },
        topics:
            discussion && (phase === 'discussing' || phase === 'actions')
                ? {
                      canPrevious: !discussion.busy && topicIndex > 0,
                      // In Actions no topic may be in focus yet: "Next
                      // topic" then opens on the first.
                      canNext:
                          !discussion.busy &&
                          (topicIndex === -1
                              ? phase === 'actions' && topicCount > 0
                              : topicIndex < topicCount - 1),
                      onStep: discussion.step,
                      onFollow: discussion.setFollows,
                  }
                : undefined,
        onSetting: (patch) =>
            void send(
                retroRequest(
                    RetroSettingsController.update(board.retro.id),
                    patch,
                ),
            ),
        onPhase: (target) =>
            void send(
                retroRequest<{ phase: RetroPhase }>(
                    RetroPhasesController.update(board.retro.id),
                    { phase: target },
                ),
            ),
    };

    const primary = hasBar
        ? facilitatorPrimary(phase, board, tools)
        : undefined;

    // The main button from the keyboard. Never from a field, where the key
    // moves the caret; elsewhere it would be "forward" in the history of
    // the browser, which `useShortcut` prevents. A held key moves one phase
    // only: the last one ends the session, without a confirmation.
    useShortcut(
        'mod+arrowright',
        (event) => {
            if (event.repeat) {
                return;
            }

            primary?.onSelect();
        },
        { enabled: primary !== undefined && !primary.disabled },
    );

    return (
        <>
            {/* Once completed, the session end docks its own bar. */}
            {phase !== 'completed' && board.retro.reactionsEnabled && (
                <BoardReactions
                    compact={isMobile}
                    offsetBottom={
                        hasBar ? DockBottomRem + barHeight : undefined
                    }
                />
            )}
            {hasBar && (
                <div
                    ref={barRef}
                    data-slot="facilitator-dock"
                    className="fixed inset-x-0 bottom-6 z-30 mx-auto flex w-fit max-w-viewport-gutter justify-center"
                >
                    <FacilitatorBar
                        compact={isMobile}
                        start={
                            <>
                                {!isMobile && (
                                    <span className="inline-flex shrink-0 items-center gap-1 px-1.5 text-xs font-semibold text-muted-foreground">
                                        <Crown
                                            className="size-3.5"
                                            aria-hidden
                                        />
                                        <span>{t('Facilitator')}</span>
                                    </span>
                                )}
                                {start}
                                {phase === 'voting' && (
                                    <VoteLimitState
                                        count={board.retro.votesPerParticipant}
                                        compact={isMobile}
                                    />
                                )}
                            </>
                        }
                        actions={facilitatorActions(phase, board, tools).filter(
                            // On a phone the timer of the bar has its own
                            // pause: one row holds the compact bar.
                            (action) => !isMobile || action.id !== 'pause',
                        )}
                        end={
                            phase === 'writing' ? (
                                <AnonymityState
                                    isAnonymous={board.retro.isAnonymous}
                                    compact={isMobile}
                                />
                            ) : undefined
                        }
                        primary={primary}
                    />
                </div>
            )}
        </>
    );
}
