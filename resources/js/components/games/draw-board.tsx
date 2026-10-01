import { useCallback, useEffect, useRef, useState } from 'react';
import GameDrawingOpsController from '@/actions/App/Http/Controllers/Games/GameDrawingOpsController';
import GameDrawingsController from '@/actions/App/Http/Controllers/Games/GameDrawingsController';
import GameLastDrawingOpsController from '@/actions/App/Http/Controllers/Games/GameLastDrawingOpsController';
import { useSecretWord } from '@/hooks/use-secret-word';
import { useStrokeWhispers } from '@/hooks/use-stroke-whispers';
import { useTrans } from '@/hooks/use-trans';
import { MaxStrokePoints } from '@/lib/games/drawing';
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
import {
    DrawingCanvas,
    type CanvasTool,
    type PreviewStroke,
} from './drawing-canvas';
import { DrawingToolbar } from './drawing-toolbar';
import { GuessChat } from './guess-chat';
import { HintButton } from './hint-button';
import { LeaderWord } from './leader-word';
import { useRoom } from './room-context';
import { WordMask } from './word-mask';

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

    return (
        <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_18rem]">
            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex min-h-14 flex-col items-center justify-center gap-1">
                    {isDrawer ? (
                        <LeaderWord
                            word={word}
                            label={t('Your word to draw')}
                        />
                    ) : (
                        <>
                            <WordMask mask={round.mask ?? []} />
                            {drawer && (
                                <p className="text-sm text-muted-foreground">
                                    {t(':name is drawing', {
                                        name: drawer.name,
                                    })}
                                </p>
                            )}
                        </>
                    )}
                </div>
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
                />
                {isDrawer && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <DrawingToolbar
                            tool={tool}
                            color={color}
                            size={size}
                            canUndo={ops.length > 0}
                            onTool={setTool}
                            onColor={setColor}
                            onSize={setSize}
                            onUndo={undo}
                            onClear={clear}
                        />
                        <HintButton round={round} />
                    </div>
                )}
            </div>
            <GuessChat round={round} isLeader={isDrawer} />
        </div>
    );
}
