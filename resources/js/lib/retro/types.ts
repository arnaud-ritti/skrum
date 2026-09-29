export type RetroPhase =
    | 'writing'
    | 'grouping'
    | 'voting'
    | 'discussing'
    | 'completed';
export type ColumnColor =
    | 'green'
    | 'red'
    | 'blue'
    | 'amber'
    | 'purple'
    | 'slate';

export type Person = { id: string; name: string };

export type CardGif = { id: string; previewUrl: string; url: string };

export type CardPayload = {
    id: string;
    columnId: string;
    parentCardId: string | null;
    position: number;
    isMine: boolean;
    hidden: boolean;
    content: string | null;
    gif: CardGif | null;
    author: Person | null;
};

export type ReactionSummary = {
    emoji: string;
    count: number;
    mine: boolean;
    names: string[];
};

export type CardComment = {
    id: string;
    cardId: string;
    parentCommentId: string | null;
    isMine: boolean;
    deleted: boolean;
    content: string | null;
    author: Person | null;
    createdAt: string;
};

export type CommentThread = CardComment & { replies: CardComment[] };

export type CommentNotificationPayload = {
    cardId: string;
    commentId: string;
    threadId: string;
    excerpt: string;
    authorName?: string;
};

export type BoardCard = CardPayload & {
    votes: number | null;
    myVotes: number;
    reactions: ReactionSummary[];
    commentCount: number;
    comments: CommentThread[];
    /**
     * Client-only: the votes version `votes` was last set at. Totals are
     * ordered per card because the votes version is global to the retro.
     */
    totalVersion?: number;
};

export type BoardColumn = {
    id: string;
    title: string;
    color: ColumnColor;
    position: number;
};

export type BoardParticipant = {
    id: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
};

export type ActionItem = {
    id: string;
    content: string;
    isDone: boolean;
    assignee: Person | null;
};

export type TransferCandidate = { userId: string; name: string };

export type Snapshot = {
    retro: {
        id: string;
        title: string;
        template: string;
        phase: RetroPhase;
        isAnonymous: boolean;
        reactionsEnabled: boolean;
        cursorsEnabled: boolean;
        gifsEnabled: boolean;
        gifProvider: 'giphy' | 'tenor' | null;
        hideVoteCounts: boolean;
        isLocked: boolean;
        presentationMode: boolean;
        votesPerParticipant: number;
        guestAccessEnabled: boolean;
        facilitatorParticipantId: string | null;
        timerEndsAt: string | null;
        highlightedCardId: string | null;
        completedAt: string | null;
        guestUrl: string | null;
    };
    viewer: {
        participantId: string;
        isFacilitator: boolean;
        isGuest: boolean;
        remainingVotes: number;
        transferCandidates: TransferCandidate[];
    };
    columns: BoardColumn[];
    cards: BoardCard[];
    participants: BoardParticipant[];
    actionItems: ActionItem[];
    votesCast: number | null;
    votesVersion: number;
    links: { team: string | null };
    emojiData: { baseUrl: string; locale: string };
    serverTime: string;
};

export type PresenceMember = {
    id: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
};

export const Phases: RetroPhase[] = [
    'writing',
    'grouping',
    'voting',
    'discussing',
    'completed',
];
