import { useCallback, useRef, useState } from 'react';
import WhiteboardSnapshotsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSnapshotsController';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import type {
    ElementsChangedPayload,
    WhiteboardSnapshot,
} from '@/lib/whiteboard/types';
import { useServerOffset } from './use-countdown';
import { useWhiteboardChannel } from './use-whiteboard-channel';

const SessionExpiredStatuses = [401, 419];

type BoardStatus = 'active' | 'ended' | 'deleted';

type BoardMeta = Pick<
    WhiteboardSnapshot,
    'board' | 'me' | 'members' | 'links' | 'emojiData' | 'viewerIsObserver'
>;

type SceneListeners = {
    onElementsChanged: (payload: ElementsChangedPayload) => void;
    onResync: () => void;
    onLeaving: (member: PresenceMember) => void;
};

export type WhiteboardState = {
    snapshot: BoardMeta;
    status: BoardStatus;
    sessionExpired: boolean;
    online: PresenceMember[];
    presence: WhisperChannel | null;
    connected: boolean;
    reconnecting: boolean;
    /** Server clock minus this browser's, in milliseconds. */
    serverOffset: number;
    refetch: () => Promise<void>;
    fail: (error: RetroRequestError) => void;
    setTimer: (timerEndsAt: string | null) => void;
    listeners: { current: SceneListeners | null };
};

/**
 * Board settings, members and access. The scene itself lives
 * in Excalidraw and is kept in step by scene-sync, which registers itself in
 * `listeners`.
 */
export function useWhiteboard(initial: WhiteboardSnapshot): WhiteboardState {
    const [snapshot, setSnapshot] = useState<BoardMeta>(initial);
    const [status, setStatus] = useState<BoardStatus>('active');
    const [sessionExpired, setSessionExpired] = useState(false);
    const initialOffset = useServerOffset(initial.serverTime);
    const [measuredOffset, setMeasuredOffset] = useState<number | null>(null);
    const listeners = useRef<SceneListeners | null>(null);
    const latestRefetch = useRef(0);
    const boardId = initial.board.id;

    const fail = useCallback((error: RetroRequestError) => {
        if (SessionExpiredStatuses.includes(error.status)) {
            setSessionExpired(true);

            return;
        }

        setStatus(error.status === 404 ? 'deleted' : 'ended');
    }, []);

    const refetch = useCallback(async () => {
        const request = ++latestRefetch.current;
        const sentAt = Date.now();

        try {
            const fresh = await retroRequest<WhiteboardSnapshot>(
                WhiteboardSnapshotsController.show(boardId),
            );

            if (request !== latestRefetch.current) {
                return;
            }

            setMeasuredOffset(
                new Date(fresh.serverTime).getTime() -
                    (sentAt + Date.now()) / 2,
            );
            setSnapshot({
                board: fresh.board,
                me: fresh.me,
                members: fresh.members,
                links: fresh.links,
                emojiData: fresh.emojiData,
                viewerIsObserver: fresh.viewerIsObserver,
            });
        } catch (error) {
            if (
                error instanceof RetroRequestError &&
                [401, 403, 404, 419].includes(error.status)
            ) {
                fail(error);
            }
        }
    }, [boardId, fail]);

    const setTimer = useCallback((timerEndsAt: string | null) => {
        setSnapshot((current) => ({
            ...current,
            board: { ...current.board, timerEndsAt },
        }));
    }, []);

    const channel = useWhiteboardChannel(boardId, status === 'active', {
        onEvent: ({ name, payload }) => {
            if (name === 'board.deleted') {
                setStatus('deleted');

                return;
            }

            if (name === 'board.changed') {
                void refetch();

                return;
            }

            if (name === 'timer.changed') {
                setTimer(
                    (payload as { timerEndsAt: string | null }).timerEndsAt,
                );

                return;
            }

            listeners.current?.onElementsChanged(
                payload as ElementsChangedPayload,
            );
        },
        onResync: () => {
            void refetch();
            listeners.current?.onResync();
        },
        onLeaving: (member) => listeners.current?.onLeaving(member),
    });

    return {
        snapshot,
        status,
        sessionExpired,
        ...channel,
        serverOffset: measuredOffset ?? initialOffset,
        refetch,
        fail,
        setTimer,
        listeners,
    };
}
