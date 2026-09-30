import { isDrawingColor, isDrawingPoint, isDrawingSize } from './drawing';
import type { DrawingColor, DrawingPoint, DrawingSize } from './types';

export const StrokeEvent = 'game-stroke';
export const StrokeWhisperPoints = 100;
export const StrokeWhisperThrottleMs = 40;

const StrokeIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

export type StrokeMessage = {
    v: 1;
    id: string;
    color: DrawingColor;
    size: DrawingSize;
    points: DrawingPoint[];
};

/** Stroke ids start with the round's id prefix, so strokes of an older round are dropped. */
export function strokeIdPrefix(roundId: string): string {
    return roundId.slice(0, 8);
}

export function newStrokeId(roundId: string): string {
    const random = Math.random().toString(36).slice(2, 12);

    return `${strokeIdPrefix(roundId)}-${Date.now().toString(36)}${random}`;
}

export function isStrokeMessage(
    raw: unknown,
    roundId: string,
): raw is StrokeMessage {
    if (typeof raw !== 'object' || raw === null) {
        return false;
    }

    const message = raw as Record<string, unknown>;

    return (
        message.v === 1 &&
        typeof message.id === 'string' &&
        StrokeIdPattern.test(message.id) &&
        message.id.startsWith(`${strokeIdPrefix(roundId)}-`) &&
        isDrawingColor(message.color) &&
        isDrawingSize(message.size) &&
        Array.isArray(message.points) &&
        message.points.length >= 1 &&
        message.points.length <= StrokeWhisperPoints &&
        message.points.every(isDrawingPoint)
    );
}

/**
 * The unsent tail of a stroke as whisper chunks of at most 100 points, each
 * starting with the previous chunk's last point so receivers draw no gap.
 */
export function strokeChunks(
    points: DrawingPoint[],
    sent: number,
): { chunks: DrawingPoint[][]; sent: number } {
    const chunks: DrawingPoint[][] = [];
    let cursor = sent;

    while (cursor < points.length) {
        const start = Math.max(0, cursor - 1);
        const chunk = points.slice(start, start + StrokeWhisperPoints);

        chunks.push(chunk);
        cursor = start + chunk.length;
    }

    return { chunks, sent: cursor };
}
