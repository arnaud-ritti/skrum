import type { PresenceMember } from '@/lib/retro/types';

export type SceneElement = Record<string, unknown> & {
    id: string;
    type: string;
    version: number;
    versionNonce: number;
    isDeleted: boolean;
};

export type VoteCount = { elementId: string; count: number };

export type VoteResult = { elementId: string; text: string; count: number };

export type VoteTally = {
    myVotes: VoteCount[];
    remaining: number;
    finishedCount: number;
};

export type WhiteboardVoting = {
    id: string;
    open: boolean;
    votesPerMember: number;
    allowMultiple: boolean;
    frameElementId: string | null;
    elementIds: string[];
    myVotes: VoteCount[];
    remaining: number;
    finishedCount: number | null;
    results: VoteResult[] | null;
};

export type PastVote = { id: string; closedAt: string; results: VoteResult[] };

export type TransferCandidate = { userId: string; name: string };

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
        locked: boolean;
        followEnabled: boolean;
        privateWriting: boolean;
        timerEndsAt: string | null;
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
    voting: WhiteboardVoting | null;
    votingHistory: PastVote[];
    links: { team: string | null };
    serverTime: string;
};

export type RejectReason =
    | 'invalid'
    | 'stale'
    | 'locked'
    | 'file'
    | 'full'
    | 'voting'
    | 'private';

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
