import { vi } from 'vitest';
import type { WhiteboardState } from '@/hooks/use-whiteboard';

type Overrides = {
    board?: Partial<WhiteboardState['snapshot']['board']>;
    me?: Partial<WhiteboardState['snapshot']['me']>;
    links?: WhiteboardState['snapshot']['links'];
    online?: WhiteboardState['online'];
};

/** A board state for container tests: Fran facilitates "Sprint board". */
export function boardState(overrides: Overrides = {}): WhiteboardState {
    const fran = {
        id: 'member-fran',
        name: 'Fran Facilitator',
        avatarUrl: '/avatars/f.svg',
        isGuest: false,
    };

    return {
        snapshot: {
            board: {
                id: 'board-1',
                title: 'Sprint board',
                teamId: 'team-1',
                facilitatorMemberId: fran.id,
                guestAccessEnabled: true,
                guestUrl: 'https://skrum.test/whiteboards/join/token-1',
                cursorsEnabled: true,
                reactionsEnabled: true,
                locked: false,
                followEnabled: false,
                timerEndsAt: null,
                ...overrides.board,
            },
            me: {
                id: fran.id,
                userId: 'user-fran',
                name: fran.name,
                avatarUrl: fran.avatarUrl,
                isGuest: false,
                isFacilitator: true,
                canTakeControl: false,
                canDelete: true,
                transferCandidates: [],
                ...overrides.me,
            },
            members: [fran],
            links: overrides.links ?? { team: '/workspaces/w/teams/t' },
        },
        status: 'active',
        sessionExpired: false,
        online: overrides.online ?? [fran],
        presence: null,
        connected: true,
        reconnecting: false,
        serverOffset: 0,
        refetch: vi.fn(async () => {}),
        fail: vi.fn(),
        setTimer: vi.fn(),
        listeners: { current: null },
    };
}
