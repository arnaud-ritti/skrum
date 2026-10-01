import type { PresenceMember } from '@/lib/retro/types';

export type SceneElement = Record<string, unknown> & {
    id: string;
    type: string;
    version: number;
    versionNonce: number;
    isDeleted: boolean;
};

export type WhiteboardSnapshot = {
    board: {
        id: string;
        title: string;
        teamId: string;
        facilitatorMemberId: string | null;
        guestAccessEnabled: boolean;
        guestUrl: string | null;
        cursorsEnabled: boolean;
        reactionsEnabled: boolean;
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
    };
    members: PresenceMember[];
    elements: SceneElement[];
    seq: number;
    links: { team: string | null };
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
