import {
    ArrowRight,
    Crown,
    Eye,
    EyeOff,
    Flag,
    Lock,
    LockOpen,
    ScanEye,
    SkipBack,
    SkipForward,
    VenetianMask,
    Vote,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import RetroPhasesController from '@/actions/App/Http/Controllers/Retros/RetroPhasesController';
import RetroSettingsController from '@/actions/App/Http/Controllers/Retros/RetroSettingsController';
import { FacilitatorBar } from '@/components/skrum/facilitator-bar';
import type { FacilitatorAction } from '@/components/skrum/facilitator-bar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { nextPhase, PhaseLabels } from '@/lib/retro/phases';
import type { RetroPhase, Snapshot } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { BoardReactions, showsRetroReactions } from './board-reactions';
import { useOptionalDiscussion } from './phase-discussing';

type Translate = (key: string) => string;

export type FacilitatorTools = {
    t: Translate;
    /** Sends one setting of the retro, as the settings popover does. */
    onSetting: (patch: Record<string, boolean>) => void;
    onPhase: (phase: RetroPhase) => void;
    busy?: boolean;
    /** The topics of the discussion: moving between them, and bringing everyone along. */
    topics?: {
        canPrevious: boolean;
        canNext: boolean;
        onStep: (offset: -1 | 1) => void;
        onFollow: (follows: boolean) => void;
    };
};

type DockBoard = Pick<Snapshot, 'retro'>;

/**
 * The facilitator's actions of a phase (spec ruling 28): every action that
 * exists today has its slot. The completed state has no bar.
 */
export function facilitatorActions(
    phase: RetroPhase,
    board: DockBoard,
    { t, onSetting, topics }: FacilitatorTools,
): FacilitatorAction[] {
    if (phase === 'completed') {
        return [];
    }

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

    return [lock];
}

/** The main button names the phase it leads to; the last phase ends the session. */
export function facilitatorPrimary(
    phase: RetroPhase,
    board: DockBoard,
    { t, onPhase, busy = false }: FacilitatorTools,
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
            onSelect: () => onPhase(target),
        };
    }

    return {
        id: 'next-phase',
        label: t(PhaseLabels[target]),
        icon: ArrowRight,
        iconPosition: 'end',
        disabled: busy,
        onSelect: () => onPhase(target),
    };
}

/**
 * "Anonymity: on" of the Writing mockup. A state, not a control: anonymity is
 * changed in the settings, where the rule that it cannot be turned off after
 * the first card is explained.
 */
function AnonymityState({ compact }: { compact: boolean }) {
    const { t } = useTrans();

    return (
        <span
            data-slot="facilitator-anonymity"
            className="inline-flex h-8 min-w-0 shrink items-center gap-1.5 px-2 text-sm font-medium"
        >
            <VenetianMask className="size-4 shrink-0" aria-hidden />
            <span className={cn('truncate', compact && 'sr-only')}>
                {t('Anonymity: on')}
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

const RootFontSize = 16;

/** Height of the bar in rem, so that the reaction bar sits a `space-3` above it. */
function useHeightInRem(): [(node: HTMLDivElement | null) => void, number] {
    const [node, setNode] = useState<HTMLDivElement | null>(null);
    const [height, setHeight] = useState(0);
    const observer = useRef<ResizeObserver | null>(null);

    useEffect(() => {
        if (node === null) {
            return;
        }

        const measure = () => {
            const root = parseFloat(
                getComputedStyle(document.documentElement).fontSize,
            );

            setHeight(
                node.getBoundingClientRect().height / (root || RootFontSize),
            );
        };

        measure();
        observer.current = new ResizeObserver(measure);
        observer.current.observe(node);

        return () => observer.current?.disconnect();
    }, [node]);

    return [setNode, node === null ? 0 : height];
}

/** Distance of the facilitator bar from the bottom of the screen: `bottom-6`. */
const DockBottomRem = 1.5;

/**
 * Bottom of the board: the reaction bar, and for the facilitator the bar of
 * the phase under it. The two never overlap (spec §6.4).
 */
export function FacilitatorDock({ start }: { start?: ReactNode }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const [busy, setBusy] = useState(false);
    const [barRef, barHeight] = useHeightInRem();
    const discussion = useOptionalDiscussion();
    const { board } = ctx;
    const { phase } = board.retro;
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

    const tools: FacilitatorTools = {
        t,
        busy,
        topics:
            discussion && phase === 'discussing'
                ? {
                      canPrevious: topicIndex > 0,
                      canNext:
                          topicIndex !== -1 &&
                          topicIndex < discussion.topics.length - 1,
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

    return (
        <>
            {showsRetroReactions(board.retro) && (
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
                                <span className="inline-flex shrink-0 items-center gap-1 px-1.5 text-xs font-semibold text-muted-foreground">
                                    <Crown className="size-3.5" aria-hidden />
                                    <span className="hidden sm:inline">
                                        {t('Facilitator')}
                                    </span>
                                </span>
                                {start}
                                {phase === 'voting' && (
                                    <VoteLimitState
                                        count={board.retro.votesPerParticipant}
                                        compact={isMobile}
                                    />
                                )}
                            </>
                        }
                        actions={facilitatorActions(phase, board, tools)}
                        end={
                            phase === 'writing' && board.retro.isAnonymous ? (
                                <AnonymityState compact={isMobile} />
                            ) : undefined
                        }
                        primary={facilitatorPrimary(phase, board, tools)}
                    />
                </div>
            )}
        </>
    );
}
