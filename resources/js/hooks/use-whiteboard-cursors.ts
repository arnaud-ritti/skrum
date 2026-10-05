import { useEffect, useMemo, useRef } from 'react';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';
import { presenceOf } from '@/lib/presence/presence-color';
import { subscribeToTheme } from '@/lib/whiteboard/appearance';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import {
    forgetPresenceCursorColors,
    presenceCursorColor,
} from '@/lib/whiteboard/presence-slot';

const SendEveryMs = 40;
const TimeToLiveMs = 3000;
const SweepEveryMs = 1000;
const MaxCursors = 50;

type CursorMessage = { x: number; y: number };

type RemoteCursor = CursorMessage & { seenAt: number };

type Options = {
    api: ExcalidrawImperativeAPI | null;
    presence: WhisperChannel | null;
    online: PresenceMember[];
    meId: string;
    /** The board's switch: off removes cursors for everyone. */
    enabled: boolean;
    /** The person's own preference: others stop seeing this cursor. */
    hidden: boolean;
};

function isCursorMessage(raw: unknown): raw is CursorMessage {
    if (typeof raw !== 'object' || raw === null) {
        return false;
    }

    const { x, y } = raw as Record<string, unknown>;

    return (
        typeof x === 'number' &&
        typeof y === 'number' &&
        Number.isFinite(x) &&
        Number.isFinite(y)
    );
}

export function useWhiteboardCursors({
    api,
    presence,
    online,
    meId,
    enabled,
    hidden,
}: Options) {
    const cursors = useRef(new Map<string, RemoteCursor>());
    const roster = useRef(online);
    const lastSent = useRef(0);

    useEffect(() => {
        roster.current = online;
    });

    const transport = useMemo(() => {
        if (!presence || !enabled) {
            return null;
        }

        return whisperTransport(
            presence,
            'cursor',
            (senderId, raw) =>
                senderId !== meId &&
                roster.current.some((member) => member.id === senderId) &&
                isCursorMessage(raw),
        );
    }, [presence, enabled, meId]);

    const render = useRef<() => void>(() => {});

    useEffect(
        () =>
            subscribeToTheme(() => {
                forgetPresenceCursorColors();
                render.current();
            }),
        [],
    );

    useEffect(() => {
        if (!api) {
            render.current = () => {};

            return;
        }

        const known = cursors.current;

        render.current = () => {
            const collaborators = new Map(
                [...known].map(([memberId, cursor]) => {
                    const member = roster.current.find(
                        (candidate) => candidate.id === memberId,
                    );

                    return [
                        memberId,
                        {
                            id: memberId,
                            username: member?.name ?? '',
                            // The canvas's own list of people is not drawn on the canvas: it shows the picture, not the cursor colour.
                            avatarUrl: member?.avatarUrl,
                            color: presenceCursorColor(
                                presenceOf(member ?? { id: memberId }),
                            ),
                            pointer: {
                                x: cursor.x,
                                y: cursor.y,
                                tool: 'pointer',
                            },
                        },
                    ];
                }),
            );

            api.updateScene({ collaborators: collaborators as never });
        };

        const draw = () => render.current();

        if (!transport) {
            known.clear();
            draw();

            return;
        }

        const stop = transport.onMessage((raw, senderId) => {
            if (!senderId) {
                return;
            }

            if (!known.has(senderId) && known.size >= MaxCursors) {
                return;
            }

            known.set(senderId, {
                ...(raw as CursorMessage),
                seenAt: Date.now(),
            });
            draw();
        });

        const sweep = setInterval(() => {
            const deadline = Date.now() - TimeToLiveMs;
            let changed = false;

            for (const [memberId, cursor] of known) {
                if (cursor.seenAt < deadline) {
                    known.delete(memberId);
                    changed = true;
                }
            }

            if (changed) {
                draw();
            }
        }, SweepEveryMs);

        return () => {
            stop();
            clearInterval(sweep);
            known.clear();
            draw();
        };
    }, [api, transport]);

    return {
        onPointerUpdate: ({
            pointer,
        }: {
            pointer: { x: number; y: number };
        }): void => {
            if (!transport || hidden) {
                return;
            }

            const now = Date.now();

            if (now - lastSent.current < SendEveryMs) {
                return;
            }

            lastSent.current = now;
            transport.send({ x: pointer.x, y: pointer.y });
        },
        forget: (memberId: string): void => {
            if (!cursors.current.delete(memberId)) {
                return;
            }

            render.current();
        },
    };
}
