import { useCallback, useEffect, useRef, useState } from 'react';
import WhiteboardSnapshotsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSnapshotsController';
import WhiteboardVoteSessionsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVoteSessionsController';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import type {
    ElementsChangedPayload,
    VoteTally,
    WhiteboardSnapshot,
    WhiteboardVoting,
} from '@/lib/whiteboard/types';
import { useServerOffset } from './use-countdown';
import { useWhiteboardChannel } from './use-whiteboard-channel';

const SessionExpiredStatuses = [401, 419];
/** One fetch of the viewer's own votes covers every vote event of this window. */
const TallyCoalesceMs = 1500;

export type BoardStatus = 'active' | 'ended' | 'deleted';

type BoardMeta = Pick<
    WhiteboardSnapshot,
    'board' | 'me' | 'members' | 'links' | 'voting' | 'votingHistory'
>;

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
    /** Server clock minus this browser's, in milliseconds. */
    serverOffset: number;
    refetch: () => Promise<void>;
    fail: (error: RetroRequestError) => void;
    setTimer: (timerEndsAt: string | null) => void;
    applyTally: (sessionId: string, tally: VoteTally) => void;
    listeners: { current: SceneListeners | null };
};

/**
 * Board settings, members, voting state and access. The scene itself lives
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
    /** Bumped by every answer to a vote of this tab: older fetches are stale. */
    const voteEpoch = useRef(0);
    const tallyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const boardId = initial.board.id;

    useEffect(
        () => () => {
            if (tallyTimer.current !== null) {
                clearTimeout(tallyTimer.current);
            }
        },
        [],
    );

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
        const epoch = voteEpoch.current;

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
            setSnapshot((current) => ({
                board: fresh.board,
                me: fresh.me,
                members: fresh.members,
                links: fresh.links,
                // A vote answered while this snapshot travelled is newer than it.
                voting:
                    epoch !== voteEpoch.current &&
                    fresh.voting?.open &&
                    current.voting?.open &&
                    current.voting.id === fresh.voting.id
                        ? current.voting
                        : fresh.voting,
                votingHistory: fresh.votingHistory,
            }));
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

    const applyTally = useCallback((sessionId: string, tally: VoteTally) => {
        voteEpoch.current += 1;
        setSnapshot((current) =>
            current.voting?.id === sessionId && current.voting.open
                ? { ...current, voting: { ...current.voting, ...tally } }
                : current,
        );
    }, []);

    /** The event does not say who voted: each client asks for its own tally. */
    const fetchTally = async (sessionId: string) => {
        const epoch = voteEpoch.current;

        try {
            const fresh = await retroRequest<WhiteboardVoting>(
                WhiteboardVoteSessionsController.show({
                    board: boardId,
                    voteSession: sessionId,
                }),
            );

            if (epoch !== voteEpoch.current) {
                return;
            }

            setSnapshot((current) =>
                current.voting?.id === fresh.id
                    ? { ...current, voting: fresh }
                    : current,
            );
        } catch {
            // The next vote event or board.changed catches up.
        }
    };

    const onVoteChanged = (sessionId: string, finishedCount: number) => {
        setSnapshot((current) =>
            current.voting?.id === sessionId && current.voting.open
                ? { ...current, voting: { ...current.voting, finishedCount } }
                : current,
        );

        if (tallyTimer.current !== null) {
            return;
        }

        tallyTimer.current = setTimeout(() => {
            tallyTimer.current = null;
            void fetchTally(sessionId);
        }, TallyCoalesceMs);
    };

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

            if (name === 'vote.changed') {
                const { sessionId, finishedCount } = payload as {
                    sessionId: string;
                    finishedCount: number;
                };

                onVoteChanged(sessionId, finishedCount);

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
        applyTally,
        listeners,
    };
}
