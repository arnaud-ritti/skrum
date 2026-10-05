import {
    cursorColor,
    elementSpace,
    leaveMessage,
    moveMessage,
    type RemoteCursor,
} from 'live-cursors';
import { LiveCursors as CursorLayer, useCursors } from 'live-cursors/react';
import { MousePointer2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { presenceVar } from '@/lib/presence/presence-color';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';
import { useRoster } from './use-roster';

const ThrottleMs = 40;

type Props = {
    presence: WhisperChannel;
    container: HTMLElement | null;
    hidden: boolean;
    selfId: string;
    online: PresenceMember[];
    labelFor: (senderId: string) => string;
    /** The sender's presence colour; the library's own colour when there is none. */
    presenceFor: (senderId: string) => number | undefined;
};

type CursorSender = { send(message: unknown): void };

/**
 * Board-agnostic cursor layer over a presence channel. Callers mount it only
 * when cursors are allowed and key it by the channel, so a new channel
 * object rebuilds the transport.
 */
export function LiveCursors({
    presence,
    container,
    hidden,
    selfId,
    online,
    labelFor,
    presenceFor,
}: Props) {
    const { roster, rosterKey } = useRoster(online);

    const [transport] = useState(() =>
        whisperTransport(presence, 'cursor', (senderId) =>
            roster.current.has(senderId),
        ),
    );

    const { cursors } = useCursors({
        transport: () => transport,
        selfId,
        container,
        enabled: !hidden,
    });

    useEffect(() => {
        cursors?.setEnabled(!hidden);
    }, [cursors, hidden]);

    useEffect(() => {
        if (!cursors) {
            return;
        }

        for (const cursor of cursors.getSnapshot()) {
            if (!roster.current.has(cursor.id)) {
                cursors.remove(cursor.id);
            }
        }
    }, [cursors, roster, rosterKey]);

    useTouchSender(container, selfId, hidden, transport);

    const label = (cursor: RemoteCursor) => labelFor(cursor.id);
    const tint = (cursor: RemoteCursor) => {
        const slot = presenceFor(cursor.id);

        return slot === undefined ? cursorColor(cursor.id) : presenceVar(slot);
    };

    return (
        <CursorLayer cursors={cursors} color={tint}>
            {(cursor, color) =>
                cursor.meta?.p === 'touch' || cursor.meta?.p === 'pen' ? (
                    <span className="flex items-center gap-1">
                        <span
                            className="block size-4 rounded-full border-2 border-card shadow"
                            style={{ backgroundColor: color }}
                        />
                        <span className="lc-label" style={{ marginTop: 0 }}>
                            {label(cursor)}
                        </span>
                    </span>
                ) : (
                    <span className="flex items-start gap-0.5">
                        <MousePointer2
                            className="size-4 drop-shadow"
                            style={{ color, fill: color }}
                            aria-hidden="true"
                        />
                        <span className="lc-label">{label(cursor)}</span>
                    </span>
                )
            }
        </CursorLayer>
    );
}

/**
 * The library tracks the mouse only; touch and pen have no hover, so their
 * position is shared while the finger or pen is down.
 */
function useTouchSender(
    container: HTMLElement | null,
    selfId: string,
    hidden: boolean,
    transport: CursorSender,
) {
    useEffect(() => {
        if (!container || hidden) {
            return;
        }

        const space = elementSpace(container);
        let last = 0;
        let pending: ReturnType<typeof setTimeout> | null = null;
        let active = false;

        const cancelPending = () => {
            if (pending) {
                clearTimeout(pending);
                pending = null;
            }
        };

        const send = (event: PointerEvent) => {
            pending = null;
            last = Date.now();

            const point = space.toNormalized(event);

            if (point) {
                transport.send(
                    moveMessage(selfId, point.x, point.y, {
                        p: event.pointerType,
                    }),
                );
            }
        };

        const onMove = (event: PointerEvent) => {
            if (event.pointerType === 'mouse' || !active) {
                return;
            }

            cancelPending();

            const wait = ThrottleMs - (Date.now() - last);

            if (wait <= 0) {
                send(event);

                return;
            }

            pending = setTimeout(() => send(event), wait);
        };

        const onDown = (event: PointerEvent) => {
            if (event.pointerType === 'mouse') {
                return;
            }

            active = true;
            send(event);
        };

        const onUp = (event: PointerEvent) => {
            if (event.pointerType === 'mouse' || !active) {
                return;
            }

            active = false;
            cancelPending();
            transport.send(leaveMessage(selfId));
        };

        container.addEventListener('pointerdown', onDown);
        container.addEventListener('pointermove', onMove);
        container.addEventListener('pointerup', onUp);
        container.addEventListener('pointercancel', onUp);

        return () => {
            cancelPending();
            container.removeEventListener('pointerdown', onDown);
            container.removeEventListener('pointermove', onMove);
            container.removeEventListener('pointerup', onUp);
            container.removeEventListener('pointercancel', onUp);
        };
    }, [container, selfId, hidden, transport]);
}
