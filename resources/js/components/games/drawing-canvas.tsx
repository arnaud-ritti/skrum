import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import {
    applyOp,
    createRaster,
    drawPreview,
    EraserColor,
    MaxStrokePoints,
    paintRaster,
    pointFromEvent,
    RasterHeight,
    RasterWidth,
    replay,
    type Raster,
} from '@/lib/games/drawing';
import {
    newStrokeId,
    strokeChunks,
    StrokeWhisperThrottleMs,
    type StrokeMessage,
} from '@/lib/games/stroke-whisper';
import type {
    DrawingColor,
    DrawingOp,
    DrawingPoint,
    DrawingSize,
} from '@/lib/games/types';
import { cn } from '@/lib/utils';

export type PreviewStroke = {
    id: string;
    color: DrawingColor;
    size: DrawingSize;
    points: DrawingPoint[];
};

export type CanvasTool = 'pen' | 'eraser' | 'fill';

export type CanvasInput = {
    tool: CanvasTool;
    color: DrawingColor;
    size: DrawingSize;
    roundId: string;
    onCommit: (op: DrawingOp, clientOpId: string) => void;
    onLive: (message: StrokeMessage) => void;
};

type LiveStroke = PreviewStroke & { sent: number };

type Props = {
    ops: DrawingOp[];
    previews?: PreviewStroke[];
    /** Absent for viewers, the history replay and every non-drawer. */
    input?: CanvasInput | null;
    label: string;
    className?: string;
};

/**
 * Committed operations are rasterised by `drawing.ts` (identical on every
 * client); live strokes are drawn on top by the browser until committed.
 */
export function DrawingCanvas({
    ops,
    previews = [],
    input = null,
    label,
    className,
}: Props) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const raster = useRef<Raster>(createRaster());
    const applied = useRef<DrawingOp[]>([]);
    const image = useRef<ImageData | null>(null);
    const live = useRef<LiveStroke | null>(null);
    const frame = useRef<number | null>(null);
    const timer = useRef<number | null>(null);
    const activePointerId = useRef<number | null>(null);
    const previewsRef = useRef(previews);
    const inputRef = useRef(input);

    useEffect(() => {
        previewsRef.current = previews;
        inputRef.current = input;
    });

    const redraw = useCallback(() => {
        frame.current = null;

        const ctx = canvas.current?.getContext('2d');

        if (!ctx || !image.current) {
            return;
        }

        ctx.putImageData(image.current, 0, 0);

        for (const stroke of previewsRef.current) {
            drawPreview(ctx, stroke.color, stroke.size, stroke.points);
        }

        if (live.current) {
            drawPreview(
                ctx,
                live.current.color,
                live.current.size,
                live.current.points,
            );
        }
    }, []);

    const scheduleRedraw = useCallback(() => {
        if (frame.current === null) {
            frame.current = requestAnimationFrame(redraw);
        }
    }, [redraw]);

    useEffect(() => {
        const ctx = canvas.current?.getContext('2d');

        if (!ctx) {
            return;
        }

        const previous = applied.current;
        const isAppend =
            ops.length >= previous.length &&
            previous.every((op, index) => ops[index] === op);

        if (isAppend) {
            for (const op of ops.slice(previous.length)) {
                applyOp(raster.current, op);
            }
        } else {
            raster.current = replay(ops);
        }

        applied.current = ops;
        image.current ??= ctx.createImageData(RasterWidth, RasterHeight);
        paintRaster(raster.current, image.current);
        scheduleRedraw();
    }, [ops, scheduleRedraw]);

    useEffect(() => {
        scheduleRedraw();
    }, [previews, scheduleRedraw]);

    const stopTimer = useCallback(() => {
        if (timer.current !== null) {
            window.clearInterval(timer.current);
            timer.current = null;
        }
    }, []);

    useEffect(
        () => () => {
            stopTimer();

            if (frame.current !== null) {
                cancelAnimationFrame(frame.current);
            }
        },
        [stopTimer],
    );

    const isDrawing = input !== null;
    const inputRoundId = input?.roundId;

    /** A stroke in progress when drawing stops or the round changes is dropped. */
    useEffect(() => {
        stopTimer();
        live.current = null;
        activePointerId.current = null;
        scheduleRedraw();
    }, [isDrawing, inputRoundId, stopTimer, scheduleRedraw]);

    const flush = useCallback(() => {
        const stroke = live.current;
        const current = inputRef.current;

        if (!stroke || !current) {
            return;
        }

        const { chunks, sent } = strokeChunks(stroke.points, stroke.sent);

        for (const points of chunks) {
            current.onLive({
                v: 1,
                id: stroke.id,
                color: stroke.color,
                size: stroke.size,
                points,
            });
        }

        stroke.sent = sent;
    }, []);

    const begin = useCallback(
        (point: DrawingPoint, color: DrawingColor, size: DrawingSize) => {
            const current = inputRef.current;

            if (!current) {
                return;
            }

            stopTimer();
            live.current = {
                id: newStrokeId(current.roundId),
                color,
                size,
                points: [point],
                sent: 0,
            };
            timer.current = window.setInterval(flush, StrokeWhisperThrottleMs);
        },
        [flush, stopTimer],
    );

    const finish = useCallback(() => {
        stopTimer();

        const stroke = live.current;

        if (!stroke) {
            return;
        }

        flush();
        live.current = null;
        inputRef.current?.onCommit(
            {
                type: 'stroke',
                color: stroke.color,
                size: stroke.size,
                points: stroke.points,
            },
            stroke.id,
        );
        scheduleRedraw();
    }, [flush, scheduleRedraw, stopTimer]);

    const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
        const current = inputRef.current;

        if (!current || (event.pointerType === 'mouse' && event.button !== 0)) {
            return;
        }

        /** A second finger while a stroke is live (multi-touch) is ignored. */
        if (activePointerId.current !== null) {
            return;
        }

        const point = pointFromEvent(event, event.currentTarget);

        if (current.tool === 'fill') {
            current.onCommit(
                {
                    type: 'fill',
                    color: current.color,
                    x: point[0],
                    y: point[1],
                },
                newStrokeId(current.roundId),
            );

            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        activePointerId.current = event.pointerId;
        begin(
            point,
            current.tool === 'eraser' ? EraserColor : current.color,
            current.size,
        );
        scheduleRedraw();
    };

    const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
        const stroke = live.current;

        if (!stroke || event.pointerId !== activePointerId.current) {
            return;
        }

        const point = pointFromEvent(event, event.currentTarget);
        const last = stroke.points[stroke.points.length - 1];

        if (last[0] === point[0] && last[1] === point[1]) {
            return;
        }

        stroke.points.push(point);

        if (stroke.points.length >= MaxStrokePoints) {
            finish();
            begin(point, stroke.color, stroke.size);
        }

        scheduleRedraw();
    };

    /** Lifting or cancelling the drawing pointer commits the stroke drawn so far. */
    const onPointerEnd = (event: PointerEvent<HTMLCanvasElement>) => {
        if (event.pointerId !== activePointerId.current) {
            return;
        }

        activePointerId.current = null;
        finish();
    };

    return (
        <canvas
            ref={canvas}
            width={RasterWidth}
            height={RasterHeight}
            role="img"
            aria-label={label}
            className={cn(
                'aspect-[4/3] w-full touch-none rounded-lg border bg-white',
                input && 'cursor-crosshair',
                className,
            )}
            onPointerDown={input ? onPointerDown : undefined}
            onPointerMove={input ? onPointerMove : undefined}
            onPointerUp={input ? onPointerEnd : undefined}
            onPointerCancel={input ? onPointerEnd : undefined}
        />
    );
}
