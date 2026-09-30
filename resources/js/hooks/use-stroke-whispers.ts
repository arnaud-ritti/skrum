import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
    isStrokeMessage,
    StrokeEvent,
    type StrokeMessage,
} from '@/lib/games/stroke-whisper';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';

export type StrokeSource = { drawerPresenceId: string; roundId: string };

/**
 * Live `game-stroke` whispers on any presence channel: a game room's, or
 * the retro's for an icebreaker (13d). Only the current drawer's
 * Reverb-stamped presence id is accepted, and only for the active round.
 */
export function useStrokeWhispers(
    presence: WhisperChannel | null,
    source: StrokeSource | null,
    onStroke: (message: StrokeMessage) => void,
): (message: StrokeMessage) => void {
    const accepted = useRef(source);
    const handler = useRef(onStroke);

    useEffect(() => {
        accepted.current = source;
        handler.current = onStroke;
    });

    const transport = useMemo(
        () =>
            presence === null
                ? null
                : whisperTransport(presence, StrokeEvent, (senderId, raw) => {
                      const current = accepted.current;

                      return (
                          current !== null &&
                          senderId === current.drawerPresenceId &&
                          isStrokeMessage(raw, current.roundId)
                      );
                  }),
        [presence],
    );

    useEffect(() => {
        if (transport === null) {
            return;
        }

        return transport.onMessage((raw) =>
            handler.current(raw as StrokeMessage),
        );
    }, [transport]);

    return useCallback(
        (message: StrokeMessage) => transport?.send(message),
        [transport],
    );
}
