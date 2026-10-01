import { useEffect, useRef, useState } from 'react';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';

const SendEveryMs = 100;
const RepeatEveryMs = 2000;
/** The canvas's own zoom limits (MIN_ZOOM, MAX_ZOOM in Excalidraw 0.18.1). */
const MinZoom = 0.1;
const MaxZoom = 30;

/** What the facilitator sees, in scene coordinates. */
type Viewport = { x: number; y: number; width: number; height: number };

type Applied = { scrollX: number; scrollY: number; zoom: number };

type Options = {
    api: ExcalidrawImperativeAPI | null;
    presence: WhisperChannel | null;
    /** The board's switch. */
    enabled: boolean;
    /** This client is the facilitator's: it sends, it never follows. */
    leading: boolean;
    facilitatorId: string | null;
};

function isViewport(raw: unknown): raw is Viewport {
    if (typeof raw !== 'object' || raw === null) {
        return false;
    }

    const { x, y, width, height } = raw as Record<string, unknown>;

    return (
        [x, y, width, height].every(
            (value) => typeof value === 'number' && Number.isFinite(value),
        ) &&
        (width as number) > 0 &&
        (height as number) > 0
    );
}

export function useWhiteboardFollow({
    api,
    presence,
    enabled,
    leading,
    facilitatorId,
}: Options) {
    const [paused, setPaused] = useState(false);
    const resumeRef = useRef<() => void>(() => {});

    useEffect(() => {
        if (!api || !presence || !enabled || !leading) {
            return;
        }

        const transport = whisperTransport(presence, 'viewport', () => false);
        let pending: ReturnType<typeof setTimeout> | null = null;
        let lastSent = 0;

        const send = () => {
            const { scrollX, scrollY, zoom, width, height } = api.getAppState();

            lastSent = Date.now();
            transport.send({
                x: -scrollX,
                y: -scrollY,
                width: width / zoom.value,
                height: height / zoom.value,
            });
        };

        const stopWatching = api.onScrollChange(() => {
            if (pending !== null) {
                return;
            }

            pending = setTimeout(
                () => {
                    pending = null;
                    send();
                },
                Math.max(0, SendEveryMs - (Date.now() - lastSent)),
            );
        });
        // Late joiners and a resized window get the view without a pan.
        const repeat = setInterval(send, RepeatEveryMs);

        send();

        return () => {
            stopWatching();
            clearInterval(repeat);

            if (pending !== null) {
                clearTimeout(pending);
            }
        };
    }, [api, presence, enabled, leading]);

    useEffect(() => {
        if (!api || !presence || !enabled || leading || !facilitatorId) {
            return;
        }

        let last: Viewport | null = null;
        let applied: Applied | null = null;
        let isPaused = false;

        const transport = whisperTransport(
            presence,
            'viewport',
            (senderId, raw) => senderId === facilitatorId && isViewport(raw),
        );

        /** Fits the whole rectangle, centred, whatever this window's shape. */
        const apply = (viewport: Viewport) => {
            const { width, height } = api.getAppState();

            if (width <= 0 || height <= 0) {
                return;
            }

            const zoom = Math.min(
                MaxZoom,
                Math.max(
                    MinZoom,
                    Math.min(width / viewport.width, height / viewport.height),
                ),
            );
            const scrollX =
                width / 2 / zoom - (viewport.x + viewport.width / 2);
            const scrollY =
                height / 2 / zoom - (viewport.y + viewport.height / 2);

            applied = { scrollX, scrollY, zoom };
            api.updateScene({
                appState: { scrollX, scrollY, zoom: { value: zoom } } as never,
            });
        };

        const stopListening = transport.onMessage((raw) => {
            last = raw as Viewport;

            if (!isPaused) {
                apply(last);
            }
        });

        // The canvas reports every change of view, ours included; one that
        // is not the view we just set is the person panning or zooming.
        const stopWatching = api.onScrollChange((scrollX, scrollY, zoom) => {
            // Before the first view arrives there is nothing to leave.
            if (!applied) {
                return;
            }

            if (
                applied.scrollX === scrollX &&
                applied.scrollY === scrollY &&
                applied.zoom === zoom.value
            ) {
                return;
            }

            isPaused = true;
            setPaused(true);
        });

        resumeRef.current = () => {
            isPaused = false;
            setPaused(false);

            if (last) {
                apply(last);
            }
        };

        return () => {
            stopListening();
            stopWatching();
            resumeRef.current = () => {};
            setPaused(false);
        };
    }, [api, presence, enabled, leading, facilitatorId]);

    const following = enabled && !leading;

    return {
        following,
        paused: following && paused,
        resume: () => resumeRef.current(),
    };
}
