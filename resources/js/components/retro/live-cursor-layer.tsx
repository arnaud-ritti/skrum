import {
    elementSpace,
    leaveMessage,
    moveMessage,
    type RemoteCursor,
} from 'live-cursors';
import { LiveCursors, useCursors } from 'live-cursors/react';
import { MousePointer2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTrans } from '@/hooks/use-trans';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/retro/whisper-transport';
import { useBoard } from './board-context';

export const HideMyCursorKey = 'skrum.hideMyCursor';

const ThrottleMs = 40;

type Props = {
    container: HTMLElement | null;
    hidden: boolean;
};

type CursorSender = { send(message: unknown): void };

export function LiveCursorLayer({ container, hidden }: Props) {
    const { board, presence } = useBoard();

    if (
        !presence ||
        !board.retro.cursorsEnabled ||
        board.retro.phase === 'completed'
    ) {
        return null;
    }

    return (
        <Cursors
            key={board.retro.id}
            presence={presence}
            container={container}
            hidden={hidden}
        />
    );
}

function Cursors({
    presence,
    container,
    hidden,
}: Props & { presence: WhisperChannel }) {
    const { board, online } = useBoard();
    const { t } = useTrans();
    const selfId = board.viewer.participantId;
    const rosterKey = online.map((member) => member.id).join(',');
    const roster = useRef(new Set<string>());

    useEffect(() => {
        roster.current = new Set(rosterKey === '' ? [] : rosterKey.split(','));
    }, [rosterKey]);

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

        const members = new Set(rosterKey === '' ? [] : rosterKey.split(','));

        for (const cursor of cursors.getSnapshot()) {
            if (!members.has(cursor.id)) {
                cursors.remove(cursor.id);
            }
        }
    }, [cursors, rosterKey]);

    useTouchSender(container, selfId, hidden, transport);

    const label = (cursor: RemoteCursor) =>
        board.retro.isAnonymous
            ? t('Participant')
            : (online.find((member) => member.id === cursor.id)?.name ??
              t('Participant'));

    return (
        <LiveCursors cursors={cursors}>
            {(cursor, color) =>
                cursor.meta?.p === 'touch' || cursor.meta?.p === 'pen' ? (
                    <span className="flex items-center gap-1">
                        <span
                            className="block size-4 rounded-full border-2 border-white shadow"
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
        </LiveCursors>
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
