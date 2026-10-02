import { Pencil } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GameDrawingOpsController from '@/actions/App/Http/Controllers/Games/GameDrawingOpsController';
import GameDrawingsController from '@/actions/App/Http/Controllers/Games/GameDrawingsController';
import GameLastDrawingOpsController from '@/actions/App/Http/Controllers/Games/GameLastDrawingOpsController';
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
import type { StrokeMessage } from '@/lib/games/stroke-whisper';
import type {
    DrawingColor,
    DrawingOp,
    DrawingSize,
    GameDrawingCount,
    GameDrawingOpResponse,
    GameRound,
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
import { HintButton } from './hint-button';
import { LeaderWord, MaskedWord } from './leader-word';
import { useRoom } from './room-context';

/** A live stroke nobody committed within this delay was abandoned (drawer offline). */
const StalePreviewMs = 3000;

type RemoteStroke = PreviewStroke & { updatedAt: number };

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
    const [tool, setTool] = useState<CanvasTool>('pen');
    const [color, setColor] = useState<DrawingColor>('black');
    const [size, setSize] = useState<DrawingSize>(10);
    const [remote, setRemote] = useState<RemoteStroke[]>([]);
    const [pending, setPending] = useState<PreviewStroke[]>([]);
    const queue = useRef<Promise<void>>(Promise.resolve());
    const committed = round.committedOpIds ?? [];
    const ops = round.drawing ?? [];
    const mask = round.mask ?? [];
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

    const undo = () => {
        enqueue(async () => {
            const undone = await ctx.run(
                retroRequest<GameDrawingCount>(
                    GameLastDrawingOpsController.destroy({
                        room: roomId,
                        round: round.id,
                    }),
                ),
            );

            if (undone) {
                ctx.apply({
                    type: 'drawing.undone',
                    roundId: round.id,
                    count: undone.count,
                });
            }
        });
    };

    const clear = () => {
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

    /**
     * The keys of the drawer, on the stage only: `useShortcut` leaves a field
     * being edited and an open dialog or menu alone. Single keys obey the
     * `single_key_shortcuts` preference once plan 18f brings it (B35).
     */
    useShortcut('p', () => setTool('pen'), { enabled: isDrawer });
    useShortcut('e', () => setTool('eraser'), { enabled: isDrawer });
    useShortcut('mod+z', undo, { enabled: isDrawer && canUndo });

    /** Where the drawer's pencil is: the end of the stroke still being drawn. */
    const livePoint = isDrawer
        ? null
        : (previews[previews.length - 1]?.points.at(-1) ?? null);

    return (
        <div
            data-slot="draw-board"
            className="flex min-h-0 w-full flex-1 flex-col items-center gap-4"
        >
            {isDrawer ? (
                <LeaderWord
                    word={word}
                    label={t('Your word to draw')}
                    action={<HintButton round={round} />}
                />
            ) : (
                <MaskedWord mask={mask} maxHints={round.maxHints ?? 0} />
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
                                      onCommit: commit,
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
                    compact={isMobile}
                    onTool={setTool}
                    onColor={setColor}
                    onSize={setSize}
                    onUndo={undo}
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
