import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { GameProvider } from '@/components/poker/game-context';
import type { GameContextValue } from '@/components/poker/game-context';
import type {
    PokerPlayer,
    PokerRound,
    PokerSnapshot,
    PokerTask,
} from '@/lib/poker/types';
import type { PresenceMember } from '@/lib/retro/types';
import { renderWithProviders } from './render';

export function pokerPlayer(
    id: string,
    name: string,
    overrides: Partial<PokerPlayer> = {},
): PokerPlayer {
    return {
        id,
        name,
        avatarUrl: `/avatars/${id}.svg`,
        isGuest: false,
        isSpectator: false,
        ...overrides,
    };
}

export function pokerRound(overrides: Partial<PokerRound> = {}): PokerRound {
    return {
        id: 'round-1',
        number: 1,
        anonymous: false,
        revealedAt: null,
        revealReason: null,
        timerEndsAt: null,
        version: 1,
        votesCount: 0,
        votes: [],
        myVote: null,
        result: null,
        ...overrides,
    };
}

export function pokerTask(
    id: string,
    title: string,
    overrides: Partial<PokerTask> = {},
): PokerTask {
    return {
        id,
        title,
        description: null,
        descriptionHtml: '',
        position: 1,
        estimate: null,
        estimatedAt: null,
        roundsCount: 0,
        votesCount: 0,
        external: null,
        ...overrides,
    };
}

type SnapshotOverrides = Omit<Partial<PokerSnapshot>, 'game' | 'me'> & {
    game?: Partial<PokerSnapshot['game']>;
    me?: Partial<PokerSnapshot['me']>;
};

/** A game of three players, Ada facilitating and viewing, one task open on its first round. */
export function pokerSnapshot(
    overrides: SnapshotOverrides = {},
): PokerSnapshot {
    const { game, me, ...rest } = overrides;

    return {
        game: {
            id: 'game-1',
            title: 'Sprint 43 refinement',
            deck: 'fibonacci',
            deckLabel: 'Fibonacci',
            cards: ['1', '2', '3', '5', '8', '?', '☕'],
            isNumeric: true,
            facilitatorPlayerId: 'ada',
            guestAccessEnabled: false,
            guestUrl: null,
            joinCode: null,
            endedAt: null,
            currentTaskId: 't1',
            tasksCount: 2,
            estimatedCount: 0,
            totalPoints: null,
            hasVotes: false,
            autoReveal: false,
            anonymousVotes: false,
            cursorsEnabled: true,
            reactionsEnabled: true,
            teamName: 'Atlas',
            ...game,
        },
        me: {
            playerId: 'ada',
            userId: 'user-ada',
            isGuest: false,
            isFacilitator: true,
            isSpectator: false,
            canVote: true,
            canEditTasks: true,
            canTakeControl: false,
            canDelete: true,
            transferCandidates: [],
            ...me,
        },
        players: [
            pokerPlayer('ada', 'Ada'),
            pokerPlayer('bob', 'Bob'),
            pokerPlayer('cleo', 'Cleo'),
        ],
        tasks: [
            pokerTask('t1', 'Login page', { position: 1 }),
            pokerTask('t2', 'Password reset', { position: 2 }),
        ],
        current: { taskId: 't1', round: pokerRound() },
        team: { id: 'atlas', workspace: 'nordlys' },
        links: { team: '/w/nordlys/teams/atlas' },
        share: {} as PokerSnapshot['share'],
        deliveries: [],
        integrations: null,
        serverTime: '2026-10-02T09:00:00Z',
        ...rest,
    };
}

export function presenceOf(snapshot: PokerSnapshot): PresenceMember[] {
    return snapshot.players.map((player) => ({
        id: player.id,
        name: player.name,
        avatarUrl: player.avatarUrl,
        isGuest: player.isGuest,
    }));
}

export type RoomHarness = RenderResult & {
    ctx: GameContextValue;
};

/** Renders a piece of the room inside the game context, every player online, mutations awaited as they are. */
export function renderInRoom(
    ui: ReactElement,
    snapshot: PokerSnapshot = pokerSnapshot(),
    overrides: Partial<GameContextValue> = {},
): RoomHarness {
    const ctx: GameContextValue = {
        snapshot,
        dispatch: vi.fn(),
        apply: vi.fn(),
        run: async <T,>(mutation: Promise<T>) => mutation,
        handleError: () => null,
        refetch: vi.fn(async () => {}),
        sessionExpired: false,
        online: presenceOf(snapshot),
        presence: null,
        serverOffset: 0,
        deckOptions: [],
        ...overrides,
    };

    return {
        ...renderWithProviders(<GameProvider value={ctx}>{ui}</GameProvider>),
        ctx,
    };
}
