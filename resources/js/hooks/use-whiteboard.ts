import { useCallback, useRef, useState } from 'react';
import WhiteboardSnapshotsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSnapshotsController';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import type {
    ElementsChangedPayload,
    WhiteboardSnapshot,
} from '@/lib/whiteboard/types';
import { useWhiteboardChannel } from './use-whiteboard-channel';

const SessionExpiredStatuses = [401, 419];

export type BoardStatus = 'active' | 'ended' | 'deleted';

type BoardMeta = Pick<WhiteboardSnapshot, 'board' | 'me' | 'members' | 'links'>;

export type SceneListeners = {
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
    refetch: () => Promise<void>;
    fail: (error: RetroRequestError) => void;
    listeners: { current: SceneListeners | null };
};

/**
 * Board settings, members and access. The scene itself lives in Excalidraw
 * and is kept in step by scene-sync, which registers itself in `listeners`.
 */
export function useWhiteboard(initial: WhiteboardSnapshot): WhiteboardState {
    const [snapshot, setSnapshot] = useState<BoardMeta>(initial);
    const [status, setStatus] = useState<BoardStatus>('active');
    const [sessionExpired, setSessionExpired] = useState(false);
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

        try {
            const fresh = await retroRequest<WhiteboardSnapshot>(
                WhiteboardSnapshotsController.show(boardId),
            );

            if (request !== latestRefetch.current) {
                return;
            }

            setSnapshot({
                board: fresh.board,
                me: fresh.me,
                members: fresh.members,
                links: fresh.links,
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
        refetch,
        fail,
        listeners,
    };
}
