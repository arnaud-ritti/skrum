import {
    ArrowRight,
    Crown,
    EyeOff,
    Flag,
    Lock,
    LockOpen,
    ScanEye,
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
import { useBoard } from './board-context';
import { BoardReactions, showsRetroReactions } from './board-reactions';

type Translate = (key: string) => string;

export type FacilitatorTools = {
    t: Translate;
    /** Sends one setting of the retro, as the settings popover does. */
    onSetting: (patch: Record<string, boolean>) => void;
    onPhase: (phase: RetroPhase) => void;
    busy?: boolean;
};

type DockBoard = Pick<Snapshot, 'retro'>;

/**
 * The facilitator's actions of a phase (spec ruling 28): every action that
 * exists today has its slot. The completed state has no bar.
 */
export function facilitatorActions(
    phase: RetroPhase,
    board: DockBoard,
    { t, onSetting }: FacilitatorTools,
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
            {
                id: 'hide-vote-counts',
                kind: 'toggle',
                label: t('Hide vote counts'),
                icon: EyeOff,
                pressed: retro.hideVoteCounts,
                onSelect: () =>
                    onSetting({ hide_vote_counts: !retro.hideVoteCounts }),
            },
        ];
    }

    if (phase === 'discussing') {
        return [
            {
                id: 'presentation',
                kind: 'toggle',
                label: t('Presentation mode'),
                icon: ScanEye,
                pressed: retro.presentationMode,
                onSelect: () =>
                    onSetting({ presentation_mode: !retro.presentationMode }),
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

    const tools: FacilitatorTools = {
        t,
        busy,
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
                            </>
                        }
                        actions={facilitatorActions(phase, board, tools)}
                        primary={facilitatorPrimary(phase, board, tools)}
                    />
                </div>
            )}
        </>
    );
}
