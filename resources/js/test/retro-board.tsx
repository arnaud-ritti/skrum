import type { ReactElement } from 'react';
import { vi } from 'vitest';
import {
    BoardContext,
    type BoardContextValue,
} from '@/components/retro/board-context';
import { isBoardEditable } from '@/lib/retro/adapters';
import type { Snapshot } from '@/lib/retro/types';
import { renderWithProviders } from '@/test/render';

type SnapshotOverrides = {
    retro?: Partial<Snapshot['retro']>;
    viewer?: Partial<Snapshot['viewer']>;
} & Partial<Omit<Snapshot, 'retro' | 'viewer'>>;

/** A facilitator's board in Writing; pass what the test is about. */
export function retroSnapshot({
    retro,
    viewer,
    ...rest
}: SnapshotOverrides = {}): Snapshot {
    return {
        retro: {
            id: 'retro-1',
            teamId: 'team-1',
            teamName: 'Atlas',
            sprintNumber: null,
            title: 'Sprint 42',
            template: 'start_stop_continue',
            phase: 'writing',
            phases: [
                'writing',
                'grouping',
                'voting',
                'discussing',
                'actions',
                'roti',
                'completed',
            ],
            healthCheckStatements: 6,
            icebreakerEnabled: false,
            icebreakerGame: 'hangman',
            votesAuto: true,
            isAnonymous: false,
            reactionsEnabled: true,
            cursorsEnabled: true,
            gifsEnabled: false,
            gifProvider: null,
            hideVoteCounts: false,
            isLocked: false,
            presentationMode: false,
            votesPerParticipant: 5,
            guestAccessEnabled: true,
            facilitatorParticipantId: 'me',
            timerEndsAt: null,
            timerPausedSeconds: null,
            topicSeconds: null,
            phaseDurations: null,
            maxVotesPerCard: null,
            maxVotesPerCardSetting: null,
            highlightedCardId: null,
            completedAt: null,
            guestUrl: 'https://skrum.test/join/token',
            joinCode: null,
            aiSummaryEnabled: false,
            ...retro,
        },
        viewer: {
            participantId: 'me',
            userId: 'user-1',
            canManageActionItems: true,
            isWorkspaceManager: false,
            isReviewFacilitator: false,
            facilitatedRetroIds: [],
            isFacilitator: true,
            isGuest: false,
            remainingVotes: 5,
            transferCandidates: [],
            canHandleSuggestions: true,
            canTakeControl: false,
            ...viewer,
        },
        columns: [],
        cards: [],
        participants: [
            {
                id: 'me',
                name: 'Alice Martin',
                avatarUrl: '/a.svg',
                isGuest: false,
            },
        ],
        actionItems: [],
        carriedActionItems: [],
        carriedActionItemsHasMore: false,
        exportSources: [],
        teamMembers: [],
        surveys: [],
        writersCount: 0,
        voting: { finishedIds: [] },
        topicNotes: [],
        roti: {
            myScore: null,
            respondents: 0,
            voterIds: [],
            canVote: false,
            revealed: false,
            results: null,
        },
        results: null,
        insights: null,
        features: { llm: false, llmProvider: null },
        healthCheck: null,
        icebreaker: null,
        icebreakerGames: [],
        integrations: {
            slack: false,
            telegram: false,
            msteams: false,
            mattermost: false,
            webhook: false,
            email: false,
        },
        linkDeliveries: [],
        votesCast: null,
        votesVersion: 0,
        links: { team: '/teams/team-1', actionItems: null, workspace: 'acme' },
        emojiData: { baseUrl: '/emoji', locale: 'en' },
        viewerIsObserver: false,
        serverTime: '2026-10-02T09:00:00.000Z',
        ...rest,
    };
}

export function boardContext(
    board: Snapshot = retroSnapshot(),
    overrides: Partial<BoardContextValue> = {},
): BoardContextValue {
    return {
        board,
        dispatch: vi.fn(),
        apply: vi.fn(),
        run: async (mutation) => {
            try {
                return await mutation;
            } catch {
                return undefined;
            }
        },
        handleError: (error) =>
            error instanceof Error ? error.message : 'error',
        hasActiveCard: () => true,
        refetch: vi.fn().mockResolvedValue(undefined),
        invalidateSurvey: vi.fn(),
        sessionExpired: false,
        online: [
            {
                id: 'me',
                name: 'Alice Martin',
                avatarUrl: '/a.svg',
                isGuest: false,
            },
            {
                id: 'bob',
                name: 'Bob Stone',
                avatarUrl: '/b.svg',
                isGuest: false,
            },
        ],
        presence: null,
        isEditable: isBoardEditable(board),
        unreadCardIds: new Set(),
        markCommentsRead: vi.fn(),
        subscribeGameEvents: () => () => {},
        subscribeRotiNudges: () => () => {},
        subscribeWritingCount: () => () => {},
        ...overrides,
    };
}

export function renderInBoard(ui: ReactElement, ctx: BoardContextValue) {
    return {
        ctx,
        ...renderWithProviders(<BoardContext value={ctx}>{ui}</BoardContext>),
    };
}
