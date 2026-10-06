import type { PresenceMember } from '@/lib/retro/types';

export type SceneElement = Record<string, unknown> & {
    id: string;
    type: string;
    version: number;
    versionNonce: number;
    isDeleted: boolean;
};

type TransferCandidate = { userId: string; name: string; avatarUrl: string };

export type WhiteboardSnapshot = {
    board: {
        id: string;
        title: string;
        teamId: string;
        facilitatorMemberId: string | null;
        guestAccessEnabled: boolean;
        guestUrl: string | null;
        joinCode: string | null;
        cursorsEnabled: boolean;
        reactionsEnabled: boolean;
        locked: boolean;
        followEnabled: boolean;
        timerEndsAt: string | null;
        /** Null for a guest. */
        teamName: string | null;
    };
    me: {
        id: string;
        userId: string | null;
        name: string;
        avatarUrl: string;
        isGuest: boolean;
        isFacilitator: boolean;
        canTakeControl: boolean;
        canDelete: boolean;
        transferCandidates: TransferCandidate[];
    };
    members: PresenceMember[];
    elements: SceneElement[];
    seq: number;
    /** Both null for a guest; `sessions` is the team's whiteboards. */
    links: { team: string | null; sessions: string | null };
    emojiData: { baseUrl: string; locale: string };
    /** The viewer is an observer of the team: they read the board, unless they facilitate it. */
    viewerIsObserver: boolean;
    serverTime: string;
};

export type RejectReason = 'invalid' | 'stale' | 'locked' | 'file' | 'full';

export type WriteResponse = {
    seq: number;
    fromSeq: number;
    rejected: {
        id: string | null;
        reason: RejectReason;
        element: SceneElement | null;
    }[];
};

export type ElementsDelta = { seq: number; elements: SceneElement[] };

export type ElementsChangedPayload = {
    seq: number;
    fromSeq: number;
    elements?: SceneElement[];
};
