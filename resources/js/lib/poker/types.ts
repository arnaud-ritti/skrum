import type { IntegrationDelivery, ShareAvailability } from '@/types';

export type PokerRevealReason = 'manual' | 'everyone_voted' | 'timer';

export type PokerResult = {
    average: number | null;
    distribution: { value: string; count: number }[];
    mode: string[];
    consensus: boolean;
    nearestCard: string | null;
    median?: number | null;
    spread?: { min: number; max: number } | null;
    agreement?: number | null;
    outliers?: { low: string[]; high: string[] };
};

export type PokerRoundVote = { playerId: string; value: string | null };

export type PokerRound = {
    id: string;
    number: number;
    anonymous: boolean;
    revealedAt: string | null;
    revealReason: PokerRevealReason | null;
    timerEndsAt: string | null;
    version: number;
    votesCount: number;
    votes: PokerRoundVote[];
    myVote: string | null;
    result: PokerResult | null;
};

export type PokerTrackerSource = 'jira' | 'linear' | 'jira_dc' | 'github';

type PokerSyncState = 'synced' | 'pending' | 'failed' | 'unsupported';

export type PokerEstimateConflict = {
    sourceEstimate: string;
    matchingCard: string | null;
};

/**
 * Guests and broadcasts only get source, key, url and isManaged; the other
 * fields come with the snapshot of a non-guest player.
 */
export type PokerTaskExternal = {
    source: PokerTrackerSource;
    key: string;
    url: string;
    isManaged: true;
    assignee?: string | null;
    sourceEstimate?: string | null;
    refreshedAt?: string | null;
    syncState?: PokerSyncState | null;
    syncError?: string | null;
    unsupportedReason?: string | null;
    status?: string | null;
    statusCategory?: 'todo' | 'in_progress' | 'done' | null;
    missing?: boolean;
    estimateConflict?: PokerEstimateConflict | null;
    syncMode?: 'webhook' | 'polling' | 'off';
};

type PokerTrackerConnection = { connected: boolean; canWrite: boolean };

type PokerIntegrations = Record<
    PokerTrackerSource,
    PokerTrackerConnection | null
>;

export type TrackerContainer = { id: string; name: string };

export type TrackerIteration = {
    id: string;
    name: string;
    state: 'active' | 'upcoming';
    startsOn: string | null;
    endsOn: string | null;
};

export type TrackerIssuePreview = {
    externalId: string;
    key: string;
    title: string;
    assignee: string | null;
    estimate: string | null;
    status: string | null;
    alreadyImported: boolean;
};

export const TrackerLabels: Record<PokerTrackerSource, string> = {
    jira: 'Jira',
    linear: 'Linear',
    jira_dc: 'Jira Data Center',
    github: 'GitHub',
};

export function isPokerTrackerSource(
    value: string,
): value is PokerTrackerSource {
    return Object.hasOwn(TrackerLabels, value);
}

export function connectedTrackers(
    integrations: PokerIntegrations | null,
): PokerTrackerSource[] {
    if (!integrations) {
        return [];
    }

    return (Object.keys(TrackerLabels) as PokerTrackerSource[]).filter(
        (source) => integrations[source]?.connected === true,
    );
}

export type PokerTask = {
    id: string;
    title: string;
    description: string | null;
    descriptionHtml: string;
    position: number;
    estimate: string | null;
    estimatedAt: string | null;
    roundsCount: number;
    /** Votes of the task's last round; the current round's own count is fresher. */
    votesCount: number;
    external: PokerTaskExternal | null;
};

export type PokerPlayer = {
    id: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
    isSpectator: boolean;
};

type PokerGame = {
    id: string;
    title: string;
    deck: string;
    deckLabel: string;
    cards: string[];
    isNumeric: boolean;
    facilitatorPlayerId: string | null;
    guestAccessEnabled: boolean;
    guestUrl: string | null;
    joinCode: string | null;
    endedAt: string | null;
    currentTaskId: string | null;
    tasksCount: number;
    estimatedCount: number;
    totalPoints: number | null;
    hasVotes: boolean;
    autoReveal: boolean;
    anonymousVotes: boolean;
    cursorsEnabled: boolean;
    reactionsEnabled: boolean;
    /** Null for a guest. */
    teamName: string | null;
};

type PokerMe = {
    playerId: string;
    userId: string | null;
    isGuest: boolean;
    isFacilitator: boolean;
    isSpectator: boolean;
    canVote: boolean;
    canEditTasks: boolean;
    canTakeControl: boolean;
    canDelete: boolean;
    transferCandidates: { userId: string; name: string }[];
};

type PokerCurrent = { taskId: string; round: PokerRound };

export type PokerSnapshot = {
    game: PokerGame;
    me: PokerMe;
    players: PokerPlayer[];
    tasks: PokerTask[];
    current: PokerCurrent | null;
    /** The route keys of the team and of its workspace; null for a guest. */
    team: { id: string; workspace: string } | null;
    /** Null for a guest. */
    links: { team: string | null };
    share: ShareAvailability;
    deliveries: IntegrationDelivery[];
    integrations: PokerIntegrations | null;
    serverTime: string;
};

export type PokerVoteResponse = {
    roundId: string;
    myVote: string | null;
    votesCount: number;
    version: number;
    revealed: boolean;
};

const SpecialCards: readonly string[] = ['?', '☕'];

export function isSpecialCard(card: string): boolean {
    return SpecialCards.includes(card);
}
