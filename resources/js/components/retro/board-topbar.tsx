import {
    ArrowLeft,
    ArrowRight,
    CircleCheck,
    Crown,
    Ellipsis,
    Keyboard,
    Lock,
    MousePointer2,
    MousePointerBan,
    RotateCcw,
    Settings2,
    Share2,
    Trash2,
    UserRoundCog,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import RetroFacilitatorsController from '@/actions/App/Http/Controllers/Retros/RetroFacilitatorsController';
import RetroPhasesController from '@/actions/App/Http/Controllers/Retros/RetroPhasesController';
import RetroTimerExtensionsController from '@/actions/App/Http/Controllers/Retros/RetroTimerExtensionsController';
import RetroTimersController from '@/actions/App/Http/Controllers/Retros/RetroTimersController';
import { LanguageSwitcher } from '@/components/language-switcher';
import { CursorToggle } from '@/components/session/cursor-preference';
import { LeaveSessionDialog } from '@/components/session/leave-session-dialog';
import { SessionPresence } from '@/components/session/session-presence';
import { SessionTimer } from '@/components/session/session-timer';
import type { TimerSuggestion } from '@/components/skrum/timer';
import { SessionTitle } from '@/components/session/session-title';
import { PhaseStepper } from '@/components/skrum/phase-stepper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useServerOffset } from '@/hooks/use-countdown';
import { useActivity } from '@/hooks/use-retro-activity';
import { useTrans } from '@/hooks/use-trans';
import type { SessionSelf } from '@/layouts/skrum/session-layout';
import { retroRequest } from '@/lib/retro/api';
import { offerFor } from '@/lib/retro/phase-durations';
import type { PhaseTimerOffer } from '@/lib/retro/phase-durations';
import {
    nextPhase,
    PhaseLabels,
    reopenPhase,
    stepperPhases,
} from '@/lib/retro/phases';
import type {
    PresenceMember,
    RetroPhase,
    Snapshot,
    TimerState,
} from '@/lib/retro/types';
import { openKeyboardShortcutsEvent } from '@/lib/shortcuts/events';
import { useBoard } from './board-context';
import { showsRetroCursors } from './board-cursors';
import { DeleteRetroDialog, HandoverDialog } from './board-dialogs';
import { BoardSettings } from './board-settings';
import { BoardShare, showsBoardShare } from './board-share';
import {
    HealthCheckButton,
    HealthCheckMenuItem,
    showsHealthCheck,
} from './health-check-button';
import { HealthCheckDialog } from './health-check-dialog';
import { useTimerPause } from './use-timer-pause';

/** Seconds "+2 min" adds, as RetroTimerExtensionsController does. */
const ExtensionSeconds = 120;

/** Title of the header: the frame gives it what the phases and the controls leave. */
export function BoardTitle() {
    const { board, online } = useBoard();
    const { t } = useTrans();
    const { move } = usePhaseMove();
    const [leaving, setLeaving] = useState(false);
    const { teamName, sprintNumber } = board.retro;
    const teamHref = board.links.team;
    // Live as the Sessions list reads it: open, and begun or holding a card.
    const asksBeforeLeaving =
        teamHref !== null &&
        board.viewer.isFacilitator &&
        board.retro.phase !== 'completed' &&
        (board.retro.startedAt !== null || board.cards.length > 0);
    const skipsPhases =
        nextPhase(board.retro.phases, board.retro.phase) !== 'completed';
    const after =
        sprintNumber === null
            ? t('Retrospective')
            : t('Sprint :number', { number: sprintNumber });
    const overline =
        teamName === null ? t('Retrospective') : `${teamName} · ${after}`;
    const steps = stepperPhases(board.retro.phases);
    const stepIndex = steps.indexOf(board.retro.phase);
    const phaseLabel = t(PhaseLabels[board.retro.phase]);
    const subtitle =
        stepIndex === -1
            ? phaseLabel
            : `${phaseLabel} · ${stepIndex + 1}/${steps.length}`;

    return (
        <>
            <SessionTitle
                backHref={teamHref}
                onBack={asksBeforeLeaving ? () => setLeaving(true) : undefined}
                overline={overline}
                subtitle={subtitle}
                badges={
                    board.retro.isLocked && (
                        <Badge variant="secondary" className="shrink-0 gap-1">
                            <Lock className="size-3" aria-hidden />
                            <span className="sr-only @session-words/session:not-sr-only">
                                {t('Board closed for editing')}
                            </span>
                        </Badge>
                    )
                }
            >
                {board.retro.title}
            </SessionTitle>
            {asksBeforeLeaving && (
                <LeaveSessionDialog
                    open={leaving}
                    onOpenChange={setLeaving}
                    title={board.retro.title}
                    peopleCount={online.length}
                    backHref={teamHref}
                    endNote={
                        skipsPhases
                            ? t('The remaining phases are skipped.')
                            : undefined
                    }
                    onEnd={async () => {
                        if (!(await move('completed'))) {
                            throw new Error('The retrospective did not end.');
                        }
                    }}
                />
            )}
        </>
    );
}

/** The viewer, for the end of the header: a guest has no account to read it from. */
export function boardSelf(board: Snapshot): SessionSelf | null {
    const me = board.participants.find(
        (participant) => participant.id === board.viewer.participantId,
    );

    return me
        ? { name: me.name, avatarUrl: me.avatarUrl, isGuest: me.isGuest }
        : null;
}

/** The move to another phase, and whether one is on its way. Resolves to false when the server refused. */
function usePhaseMove(): {
    busy: boolean;
    move: (target: string) => Promise<boolean>;
} {
    const ctx = useBoard();
    const [busy, setBusy] = useState(false);
    const retroId = ctx.board.retro.id;

    const move = async (target: string): Promise<boolean> => {
        setBusy(true);

        const response = await ctx.run(
            retroRequest<{ phase: RetroPhase }>(
                RetroPhasesController.update(retroId),
                { phase: target },
            ),
        );

        if (response) {
            await ctx.refetch();
        }

        setBusy(false);

        return response !== undefined;
    };

    return { busy, move };
}

/** The phases of the header, at every width: the stepper folds with the bar. */
export function BoardPhases() {
    const ctx = useBoard();
    const { t } = useTrans();
    const { busy, move } = usePhaseMove();
    const { retro, viewer, participants } = ctx.board;

    return (
        <PhaseStepper
            bar
            phases={stepperPhases(retro.phases).map((phase) => ({
                id: phase,
                label: t(PhaseLabels[phase]),
            }))}
            current={retro.phase}
            interactive={viewer.isFacilitator}
            disabled={busy}
            reopenTo={reopenPhase(retro.phases) ?? undefined}
            leaderName={
                participants.find(
                    (participant) =>
                        participant.id === retro.facilitatorParticipantId,
                )?.name
            }
            onPhaseChange={(target) => void move(target)}
        />
    );
}

type PhaseMenuEntry = {
    label: string;
    icon: ReactNode;
    target: RetroPhase | null;
};

/**
 * "Previous" and "Next" of the facilitator on a phone, where the bar has no
 * room for them: "Next" is "Complete" on the last phase, and "Reopen" is the
 * only entry once the retro is completed. The menu closes on a choice:
 * the move in flight lives with the header, so that the entries come back
 * disabled while it is on its way.
 */
function PhaseMenuItems({ busy, move }: ReturnType<typeof usePhaseMove>) {
    const { board } = useBoard();
    const { t } = useTrans();
    const { phase, phases } = board.retro;
    const steps = stepperPhases(phases);
    const index = steps.indexOf(phase);
    const isCompleted = phase === 'completed';

    const previous: PhaseMenuEntry = {
        label: t('Previous'),
        icon: <ArrowLeft aria-hidden />,
        target: steps[index - 1] ?? null,
    };
    const forward: PhaseMenuEntry = isCompleted
        ? {
              label: t('Reopen'),
              icon: <RotateCcw aria-hidden />,
              target: reopenPhase(phases),
          }
        : index === steps.length - 1
          ? {
                label: t('Complete'),
                icon: <CircleCheck aria-hidden />,
                target: 'completed',
            }
          : {
                label: t('Next'),
                icon: <ArrowRight aria-hidden />,
                target: index === -1 ? null : steps[index + 1],
            };
    const entries = isCompleted ? [forward] : [previous, forward];

    return (
        <>
            {entries.map((entry) => (
                <DropdownMenuItem
                    key={entry.label}
                    disabled={busy || entry.target === null}
                    onSelect={() => {
                        if (entry.target !== null) {
                            void move(entry.target);
                        }
                    }}
                >
                    {entry.icon}
                    <span className="truncate">{entry.label}</span>
                </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
        </>
    );
}

/** Spec §9.5: the phase's duration as the timer's first offer, per topic in Discussing. */
function useOfferSuggestion(
    offer: PhaseTimerOffer | null,
): TimerSuggestion | undefined {
    const { t } = useTrans();

    if (offer === null) {
        return undefined;
    }

    const replace = {
        phase: t(PhaseLabels[offer.phase]),
        count: offer.seconds / 60,
    };

    if (offer.perTopic) {
        return {
            seconds: offer.seconds,
            label: t(':phase · :count min per topic', replace),
            startLabel: t(
                'Start the :phase timer, :count minutes per topic',
                replace,
            ),
        };
    }

    return {
        seconds: offer.seconds,
        label: t(':phase · :count min', replace),
        startLabel: t('Start the :phase timer, :count minutes', replace),
    };
}

/**
 * The countdown, for everyone. `controls` adds what only the facilitator of
 * an open retro has: the list 1, 3, 5, 10, "Stop timer" and "+2 min".
 */
export function BoardTimer({
    controls = true,
    size,
    caption,
    totalSeconds,
}: {
    controls?: boolean;
    size?: 'md' | 'lg';
    caption?: ReactNode;
    /** The seconds of the ring when the timer was not started from here. */
    totalSeconds?: number;
}) {
    const ctx = useBoard();
    const { board } = ctx;
    const { retro } = board;
    const offset = useServerOffset(board.serverTime);
    const timerPause = useTimerPause();
    // The seconds chosen at start, for the ring. `endsAt` is null while the
    // timer is paused: the ring comes back with the end the resume sets.
    const [started, setStarted] = useState<{
        endsAt: string | null;
        seconds: number;
    } | null>(null);
    const canControl =
        controls && board.viewer.isFacilitator && retro.phase !== 'completed';
    const canPause = canControl && retro.phase !== 'icebreaker';
    const startedHere =
        started !== null && started.endsAt === retro.timerEndsAt;
    const suggestion = useOfferSuggestion(
        canControl ? offerFor(retro.phaseDurations, retro.phase) : null,
    );

    const set = async (seconds: number | null) => {
        const response = await ctx.run(
            retroRequest<TimerState>(RetroTimersController.update(retro.id), {
                seconds,
            }),
        );

        if (!response) {
            return;
        }

        setStarted(
            seconds !== null && response.timerEndsAt !== null
                ? { endsAt: response.timerEndsAt, seconds }
                : null,
        );
        ctx.apply({ type: 'timer.set', ...response });
    };

    const extend = async () => {
        const response = await ctx.run(
            retroRequest<TimerState>(
                RetroTimerExtensionsController.store(retro.id),
            ),
        );

        if (!response) {
            return;
        }

        setStarted((current) =>
            current !== null && current.endsAt === retro.timerEndsAt
                ? {
                      endsAt: response.timerEndsAt,
                      seconds: current.seconds + ExtensionSeconds,
                  }
                : null,
        );
        ctx.apply({ type: 'timer.set', ...response });
    };

    const pause = async () => {
        const response = await timerPause.pause();

        if (!response) {
            return;
        }

        setStarted((current) =>
            current !== null && current.endsAt === retro.timerEndsAt
                ? { endsAt: null, seconds: current.seconds }
                : null,
        );
    };

    const resume = async () => {
        const response = await timerPause.resume();

        if (!response) {
            return;
        }

        setStarted((current) =>
            current !== null && current.endsAt === null
                ? { endsAt: response.timerEndsAt, seconds: current.seconds }
                : null,
        );
    };

    return (
        <SessionTimer
            endsAt={retro.timerEndsAt}
            offset={offset}
            pausedSeconds={retro.timerPausedSeconds}
            totalSeconds={startedHere ? started.seconds : totalSeconds}
            suggestion={suggestion}
            onStart={canControl ? (seconds) => void set(seconds) : undefined}
            onStop={canControl ? () => void set(null) : undefined}
            onExtend={canControl ? () => void extend() : undefined}
            onPause={canPause ? () => void pause() : undefined}
            onResume={canControl ? () => void resume() : undefined}
            size={size}
            caption={caption}
            className="shrink-0"
        />
    );
}

export function BoardPresence() {
    const { board, online } = useBoard();
    const { entries, writingCount } = useActivity();
    const isAnonymous = board.retro.isAnonymous;

    return (
        <SessionPresence
            online={online}
            selfId={board.viewer.participantId}
            facilitatorId={board.retro.facilitatorParticipantId}
            {...(isAnonymous
                ? { typingCount: writingCount }
                : {
                      typingFor: (member: PresenceMember) =>
                          entries.some(
                              (entry) =>
                                  entry.kind === 'writing' &&
                                  entry.senderId === member.id,
                          ),
                  })}
            className="shrink-0 flex-nowrap"
        />
    );
}

/** The pointer mode as an entry of the menu, where the bar has no room for its button. */
function CursorMenuItem({
    hidden,
    onChange,
}: {
    hidden: boolean;
    onChange: (hidden: boolean) => void;
}) {
    const { t } = useTrans();

    return (
        <DropdownMenuItem onSelect={() => onChange(!hidden)}>
            {hidden ? (
                <MousePointer2 aria-hidden />
            ) : (
                <MousePointerBan aria-hidden />
            )}
            <span className="truncate">
                {hidden ? t('Show my cursor') : t('Hide my cursor')}
            </span>
        </DropdownMenuItem>
    );
}

const ReopenGuardMs = 250;

type OpenPanel = 'settings' | 'share' | 'health' | 'handover' | 'delete' | null;

type ActionsProps = {
    hideMyCursor: boolean;
    onHideMyCursorChange: (hidden: boolean) => void;
    /**
     * Below `md` the header holds one menu: every entry moves into it, the
     * phase moves of the facilitator included.
     */
    mobile?: boolean;
    /**
     * The bar has no room for the secondary controls: the pointer mode, the
     * settings, the health check and the keyboard shortcuts are entries of
     * the menu, which everyone then has.
     */
    folded?: boolean;
};

/**
 * A team facilitator, owner or manager makes themselves the facilitator of
 * the open retro (decision 2 B), as "Take control" does on poker and
 * whiteboards; the server's refusal comes back as a toast.
 */
function useTakeControl(): () => void {
    const ctx = useBoard();
    const { retro, viewer } = ctx.board;

    const takeControl = async () => {
        const response = await ctx.run(
            retroRequest(RetroFacilitatorsController.update(retro.id), {
                user_id: viewer.userId,
            }).then(() => true),
        );

        if (response) {
            await ctx.refetch();
        }
    };

    return () => void takeControl();
}

export function BoardActions({
    hideMyCursor,
    onHideMyCursorChange,
    mobile = false,
    folded = false,
}: ActionsProps) {
    const { board } = useBoard();
    const takeControl = useTakeControl();
    const phaseMove = usePhaseMove();
    const { t } = useTrans();
    const [panel, setPanel] = useState<OpenPanel>(null);
    const settingsButton = useRef<HTMLButtonElement>(null);
    const menuButton = useRef<HTMLButtonElement>(null);
    const pendingFromMenu = useRef<OpenPanel>(null);
    const settingsClosedAt = useRef(0);
    const { retro, viewer } = board;
    const isCompleted = retro.phase === 'completed';
    const hasCursors = showsRetroCursors(retro);
    const hasShare = showsBoardShare(board);
    const hasShareButton = hasShare && !isCompleted && !mobile;
    const hasShareEntry = hasShare && !hasShareButton;
    const hasHealthCheck = showsHealthCheck(board);

    // A health check removed while open must not open again by itself
    // when one is added back.
    if (panel === 'health' && !hasHealthCheck) {
        setPanel(null);
    }

    const inMenu = mobile || folded;
    const canTakeControl = viewer.canTakeControl && viewer.userId !== null;
    const hasMenu = viewer.isFacilitator || canTakeControl || inMenu;

    const close = (open: boolean) => {
        if (open) {
            return;
        }

        if (panel === 'settings') {
            settingsClosedAt.current = Date.now();
        }

        setPanel(null);
    };

    /**
     * A press on the settings button while the popover is open first closes
     * it (a press outside), then reaches the button: it must not reopen it.
     */
    const toggleSettings = () => {
        if (Date.now() - settingsClosedAt.current < ReopenGuardMs) {
            return;
        }

        setPanel(panel === 'settings' ? null : 'settings');
    };

    /**
     * A panel chosen in the menu opens once the menu is gone: while it
     * closes, the menu still holds the focus and takes it back, which would
     * dismiss the settings popover at once.
     */
    const fromMenu = (target: OpenPanel) => {
        pendingFromMenu.current = target;
    };

    return (
        <>
            {hasCursors && !inMenu && (
                <CursorToggle
                    hidden={hideMyCursor}
                    onChange={onHideMyCursorChange}
                />
            )}
            {!inMenu && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            ref={settingsButton}
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('Settings')}
                            aria-haspopup="dialog"
                            aria-expanded={panel === 'settings'}
                            onClick={toggleSettings}
                        >
                            <Settings2 aria-hidden />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('Settings')}</TooltipContent>
                </Tooltip>
            )}
            {hasHealthCheck && !inMenu && (
                <HealthCheckButton onOpen={() => setPanel('health')} />
            )}
            {hasShareButton && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPanel('share')}
                    className="shrink-0"
                >
                    <Share2 aria-hidden />
                    <span className="sr-only @session-words/session:not-sr-only @session-words/session:truncate">
                        {t('Share')}
                    </span>
                </Button>
            )}
            {hasMenu && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            ref={menuButton}
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={
                                viewer.isFacilitator
                                    ? t('Facilitator menu')
                                    : t('Menu')
                            }
                        >
                            <Ellipsis aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        size="wide"
                        onCloseAutoFocus={(event) => {
                            const target = pendingFromMenu.current;

                            if (target === null) {
                                return;
                            }

                            // The panel takes the focus, not the trigger.
                            pendingFromMenu.current = null;
                            event.preventDefault();
                            setPanel(target);
                        }}
                    >
                        {mobile && viewer.isFacilitator && (
                            <PhaseMenuItems {...phaseMove} />
                        )}
                        {inMenu && hasHealthCheck && (
                            <HealthCheckMenuItem
                                onSelect={() => fromMenu('health')}
                            />
                        )}
                        {folded && !mobile && hasCursors && (
                            <CursorMenuItem
                                hidden={hideMyCursor}
                                onChange={onHideMyCursorChange}
                            />
                        )}
                        <DropdownMenuItem onSelect={() => fromMenu('settings')}>
                            <Settings2 aria-hidden />
                            <span className="truncate">{t('Settings…')}</span>
                        </DropdownMenuItem>
                        {folded && !mobile && (
                            <DropdownMenuItem
                                onSelect={() =>
                                    window.dispatchEvent(
                                        new Event(openKeyboardShortcutsEvent),
                                    )
                                }
                            >
                                <Keyboard aria-hidden />
                                <span className="truncate">
                                    {t('Keyboard shortcuts')}
                                </span>
                            </DropdownMenuItem>
                        )}
                        {hasShareEntry && (
                            <DropdownMenuItem
                                onSelect={() => fromMenu('share')}
                            >
                                <Share2 aria-hidden />
                                <span className="truncate">{t('Share…')}</span>
                            </DropdownMenuItem>
                        )}
                        {mobile && hasCursors && (
                            <CursorMenuItem
                                hidden={hideMyCursor}
                                onChange={onHideMyCursorChange}
                            />
                        )}
                        {canTakeControl && (
                            <DropdownMenuItem onSelect={takeControl}>
                                <Crown aria-hidden />
                                <span className="truncate">
                                    {t('Take control')}
                                </span>
                            </DropdownMenuItem>
                        )}
                        {viewer.isFacilitator && (
                            <>
                                <DropdownMenuItem
                                    onSelect={() => fromMenu('handover')}
                                >
                                    <UserRoundCog aria-hidden />
                                    <span className="truncate">
                                        {t('Hand over facilitation…')}
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => fromMenu('delete')}
                                >
                                    <Trash2 aria-hidden />
                                    <span className="truncate">
                                        {t('Delete retrospective…')}
                                    </span>
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {viewer.isGuest && !mobile && <LanguageSwitcher />}
            <BoardSettings
                open={panel === 'settings'}
                onOpenChange={close}
                anchorRef={inMenu ? menuButton : settingsButton}
            />
            {hasShare && (
                <BoardShare open={panel === 'share'} onOpenChange={close} />
            )}
            {hasHealthCheck && (
                <HealthCheckDialog
                    open={panel === 'health'}
                    onOpenChange={close}
                />
            )}
            {viewer.isFacilitator && (
                <>
                    <HandoverDialog
                        open={panel === 'handover'}
                        onOpenChange={close}
                    />
                    <DeleteRetroDialog
                        open={panel === 'delete'}
                        onOpenChange={close}
                    />
                </>
            )}
        </>
    );
}
