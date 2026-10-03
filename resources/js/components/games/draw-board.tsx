import { Pencil, Shuffle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GameDrawingOpsController from '@/actions/App/Http/Controllers/Games/GameDrawingOpsController';
import GameDrawingsController from '@/actions/App/Http/Controllers/Games/GameDrawingsController';
import GameLastDrawingOpsController from '@/actions/App/Http/Controllers/Games/GameLastDrawingOpsController';
import GameWordChangesController from '@/actions/App/Http/Controllers/Games/GameWordChangesController';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSecretWord } from '@/hooks/use-secret-word';
import { useShortcut } from '@/hooks/use-shortcut';
import { useStrokeWhispers } from '@/hooks/use-stroke-whispers';
import { useTrans } from '@/hooks/use-trans';
import {
    DrawingHeight,
    DrawingWidth,
    MaxStrokePoints,
} from '@/lib/games/drawing';
import { popRedo, pushUndone, type RedoStack } from '@/lib/games/redo';
import type { StrokeMessage } from '@/lib/games/stroke-whisper';
import type {
    DrawingColor,
    DrawingOp,
    DrawingSize,
    GameDrawingCount,
    GameDrawingOpResponse,
    GameRound,
    GameWordChangeResponse,
} from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import {
    DrawingCanvas,
    type CanvasTool,
    type PreviewStroke,
} from './drawing-canvas';
import { DrawingToolbar } from './drawing-toolbar';
import { useHasRightColumn, useStageFooter } from './game-layout';
import { GuessChat, GuessDock } from './guess-chat';
import { AutoHintCountdown } from './auto-hint-countdown';
import { HintButton } from './hint-button';
import { LeaderWord, MaskedWord } from './leader-word';
import { useRoom } from './room-context';

/** A live stroke nobody committed within this delay was abandoned (drawer offline). */
const StalePreviewMs = 3000;

type RemoteStroke = PreviewStroke & { updatedAt: number };

/**
 * Mirrors DrawAndGuessRules::WordChangesAllowed: the public start of a round
 * does not tell the drawer, only their snapshot does.
 */
const WordChangesAllowed = 1;

/**
 * "New word (1)" on the drawer's word card (spec §6.15): once per round,
 * while nobody has found the word; the server's 409 comes as a toast.
 */
function NewWordButton({
    round,
    onChanged,
}: {
    round: GameRound;
    onChanged: () => void;
}) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const left = round.wordChangesLeft ?? WordChangesAllowed;
    const someoneFound = (round.finders ?? []).length > 0;

    const change = async () => {
        setBusy(true);

        let response: GameWordChangeResponse | undefined;

        try {
            response = await ctx.run(
                retroRequest<GameWordChangeResponse>(
                    GameWordChangesController.store({
                        room: ctx.snapshot.room.id,
                        round: round.id,
                    }),
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        ctx.apply({
            type: 'word.changed',
            change: {
                roundId: response.roundId,
                mask: response.mask,
                maxHints: response.maxHints,
            },
        });
        ctx.apply({
            type: 'round.patched',
            roundId: response.roundId,
            patch: {
                word: response.word,
                wordChangesLeft: response.wordChangesLeft,
            },
        });
        onChanged();
    };

    const button = (
        <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-w-0"
            disabled={busy || left === 0 || someoneFound}
            onClick={() => void change()}
        >
            <Shuffle aria-hidden />
            <span className="truncate">
                {t('New word (:count)', { count: left })}
            </span>
        </Button>
    );

    if (!someoneFound) {
        return button;
    }

    const reason = t('Someone has already found the word.');

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    data-slot="new-word-closed"
                    role="group"
                    tabIndex={0}
                    aria-label={reason}
                    className="inline-flex min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {button}
                </span>
            </TooltipTrigger>
            <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
    );
}

export function DrawBoard({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const { snapshot, presence } = ctx;
    const roomId = snapshot.room.id;
    const isDrawer = round.leaderPlayerId === snapshot.me.playerId;
    const drawer =
        snapshot.players.find((player) => player.id === round.leaderPlayerId) ??
        null;
    const word = useSecretWord(round);
    const isFinder = (round.finders ?? []).some(
        (finder) => finder.playerId === snapshot.me.playerId,
    );
    const [tool, setTool] = useState<CanvasTool>('pen');
    const [color, setColor] = useState<DrawingColor>('black');
    const [size, setSize] = useState<DrawingSize>(10);
    const [remote, setRemote] = useState<RemoteStroke[]>([]);
    const [pending, setPending] = useState<PreviewStroke[]>([]);
    const [redo, setRedo] = useState<{ roundId: string; stack: RedoStack }>({
        roundId: round.id,
        stack: [],
    });
    const queue = useRef<Promise<void>>(Promise.resolve());
    const latestOps = useRef<DrawingOp[]>([]);
    const committed = round.committedOpIds ?? [];
    const ops = round.drawing ?? [];
    const mask = round.mask ?? [];
    /** What Undo took in this round, for Redo; a new round starts without. */
    const redoStack = redo.roundId === round.id ? redo.stack : [];
    const isMobile = useIsMobile();
    const hasRightColumn = useHasRightColumn();
    const footer = useStageFooter();

    const receive = useCallback((message: StrokeMessage) => {
        setRemote((current) => {
            const existing = current.find((stroke) => stroke.id === message.id);
            const points = existing
                ? [...existing.points, ...message.points.slice(1)]
                : message.points;
            const stroke: RemoteStroke = {
                id: message.id,
                color: message.color,
                size: message.size,
                points: points.slice(-MaxStrokePoints),
                updatedAt: Date.now(),
            };

            return [
                ...current.filter((known) => known.id !== message.id),
                stroke,
            ];
        });
    }, []);

    const sendStroke = useStrokeWhispers(
        presence,
        !isDrawer && drawer
            ? { drawerPresenceId: drawer.presenceId, roundId: round.id }
            : null,
        receive,
    );

    useEffect(() => {
        if (isDrawer) {
            return;
        }

        const interval = window.setInterval(() => {
            const cutoff = Date.now() - StalePreviewMs;

            setRemote((current) =>
                current.some((stroke) => stroke.updatedAt < cutoff)
                    ? current.filter((stroke) => stroke.updatedAt >= cutoff)
                    : current,
            );
        }, 1000);

        return () => window.clearInterval(interval);
    }, [isDrawer]);

    /** Operations are sent one after the other so the server keeps the drawer's order. */
    const enqueue = (task: () => Promise<void>) => {
        queue.current = queue.current.then(task, task);
    };

    const commit = (op: DrawingOp, clientOpId: string) => {
        if (op.type === 'stroke') {
            setPending((current) => [
                ...current,
                {
                    id: clientOpId,
                    color: op.color,
                    size: op.size,
                    points: op.points,
                },
            ]);
        }

        enqueue(async () => {
            let response: GameDrawingOpResponse | undefined;

            try {
                response = await ctx.run(
                    retroRequest<GameDrawingOpResponse>(
                        GameDrawingOpsController.store({
                            room: roomId,
                            round: round.id,
                        }),
                        { client_op_id: clientOpId, op },
                    ),
                );
            } finally {
                setPending((current) =>
                    current.filter((stroke) => stroke.id !== clientOpId),
                );
            }

            /**
             * The broadcast skips the sender, so the drawer applies its own op
             * here, through `apply` so a refetch in flight cannot wipe it.
             */
            if (response) {
                ctx.apply({
                    type: 'drawing.added',
                    roundId: round.id,
                    op: response.op,
                    clientOpId: response.clientOpId,
                    count: response.count,
                });
            }
        });
    };

    const forgetUndone = () => setRedo({ roundId: round.id, stack: [] });

    const draw = (op: DrawingOp, clientOpId: string) => {
        forgetUndone();
        commit(op, clientOpId);
    };

    /**
     * The undone operation is read when the undo's turn in the queue comes,
     * so undos sent in a row each keep their own; a refused undo keeps none.
     */
    const undo = () => {
        enqueue(async () => {
            const roundId = round.id;
            const last = latestOps.current.at(-1);
            const undone = await ctx.run(
                retroRequest<GameDrawingCount>(
                    GameLastDrawingOpsController.destroy({
                        room: roomId,
                        round: roundId,
                    }),
                ),
            );

            if (!undone) {
                return;
            }

            setRedo((current) => ({
                roundId,
                stack: pushUndone(
                    current.roundId === roundId ? current.stack : [],
                    last,
                ),
            }));
            ctx.apply({
                type: 'drawing.undone',
                roundId,
                count: undone.count,
            });
        });
    };

    const redoLast = () => {
        const { op, rest } = popRedo(redoStack);

        if (op === null) {
            return;
        }

        setRedo({ roundId: round.id, stack: rest });
        commit(op, crypto.randomUUID());
    };

    const clear = () => {
        forgetUndone();
        enqueue(async () => {
            const cleared = await ctx.run(
                retroRequest<GameDrawingCount>(
                    GameDrawingsController.destroy({
                        room: roomId,
                        round: round.id,
                    }),
                ),
            );

            if (cleared) {
                ctx.apply({ type: 'drawing.cleared', roundId: round.id });
            }
        });
    };

    const previews = isDrawer
        ? pending
        : remote.filter((stroke) => !committed.includes(stroke.id));
    const canUndo = ops.length > 0;
    const canRedo = redoStack.length > 0;

    latestOps.current = ops;

    /**
     * The keys of the drawer, on the stage only: `useShortcut` leaves a field
     * being edited and an open dialog or menu alone. Single keys obey the
     * `single_key_shortcuts` preference through `useShortcut` (B35).
     */
    useShortcut('p', () => setTool('pen'), { enabled: isDrawer });
    useShortcut('e', () => setTool('eraser'), { enabled: isDrawer });
    useShortcut('mod+z', undo, { enabled: isDrawer && canUndo });
    useShortcut('mod+shift+z', redoLast, { enabled: isDrawer && canRedo });
    useShortcut('mod+y', redoLast, { enabled: isDrawer && canRedo });

    /** Where the drawer's pencil is: the end of the stroke still being drawn. */
    const livePoint = isDrawer
        ? null
        : (previews[previews.length - 1]?.points.at(-1) ?? null);

    return (
        <div
            data-slot="draw-board"
            className="flex min-h-0 w-full flex-1 flex-col items-center gap-4"
        >
            {isDrawer && (
                <LeaderWord
                    word={word}
                    label={t('Your word to draw')}
                    action={
                        <div className="flex min-w-0 flex-wrap items-center gap-1">
                            <HintButton round={round} />
                            <NewWordButton
                                round={round}
                                onChanged={forgetUndone}
                            />
                        </div>
                    }
                    footnote={<AutoHintCountdown round={round} />}
                />
            )}
            {!isDrawer && isFinder && round.word !== undefined && (
                <LeaderWord
                    word={round.word}
                    label={t('You found it!')}
                    secret={false}
                />
            )}
            {!isDrawer && !(isFinder && round.word !== undefined) && (
                <MaskedWord
                    mask={mask}
                    maxHints={round.maxHints ?? 0}
                    footnote={<AutoHintCountdown round={round} />}
                />
            )}
            <div
                className={cn(
                    'draw-area grid aspect-4/3 min-h-48 w-full max-w-4xl place-items-center',
                    /** Beside the guesses the sheet gives way to the toolbar; above them the stage scrolls. */
                    hasRightColumn ? 'shrink' : 'shrink-0',
                )}
            >
                <div data-slot="draw-sheet" className="draw-sheet relative">
                    <DrawingCanvas
                        ops={ops}
                        previews={previews}
                        input={
                            isDrawer
                                ? {
                                      tool,
                                      color,
                                      size,
                                      roundId: round.id,
                                      onCommit: draw,
                                      onLive: sendStroke,
                                  }
                                : null
                        }
                        label={isDrawer ? t('Your drawing') : t('The drawing')}
                        className="aspect-auto size-full rounded-xl shadow-raised"
                    />
                    {livePoint !== null && drawer && (
                        <span
                            aria-hidden
                            data-slot="draw-pen"
                            className="pointer-events-none absolute flex items-start gap-0.5 text-foreground"
                            style={{
                                left: `${(livePoint[0] / DrawingWidth) * 100}%`,
                                top: `${(livePoint[1] / DrawingHeight) * 100}%`,
                            }}
                        >
                            <Pencil className="size-5 -translate-x-0.5 -translate-y-4.5 text-primary" />
                            <span className="max-w-32 truncate rounded-full border border-card bg-primary px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap text-primary-foreground shadow-sm">
                                {drawer.name}
                            </span>
                        </span>
                    )}
                </div>
            </div>
            {isDrawer && (
                <DrawingToolbar
                    tool={tool}
                    color={color}
                    size={size}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    compact={isMobile}
                    onTool={setTool}
                    onColor={setColor}
                    onSize={setSize}
                    onUndo={undo}
                    onRedo={redoLast}
                    onClear={clear}
                />
            )}
            {!hasRightColumn && footer === null && (
                <GuessChat
                    fieldFirst
                    round={round}
                    isLeader={isDrawer}
                    className="max-h-72 w-full max-w-4xl shrink-0"
                />
            )}
            {footer !== null &&
                createPortal(
                    <GuessDock round={round} isLeader={isDrawer} />,
                    footer,
                )}
        </div>
    );
}
