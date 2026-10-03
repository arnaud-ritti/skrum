import type { BenchGroup } from '@/components/dev/bench';
import { GameProvider } from '@/components/poker/game-context';
import type { GameContextValue } from '@/components/poker/game-context';
import { RoomView } from '@/components/poker/poker-room';
import type {
    PokerPlayer,
    PokerRound,
    PokerSnapshot,
    PokerTask,
} from '@/lib/poker/types';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';

export const group: BenchGroup = 'layouts';

/*
 * Names, titles and ticket keys are written by users or come from a tracker:
 * they are not translated.
 */
const People = [
    'Arnaud Ritti',
    'Camille Roux',
    'Théo Martin',
    'Inès Benali',
    'Malik Koné',
    'Sofia Lindqvist',
    'Lucas Durand',
    'Nadia Kowalski',
];

const players: PokerPlayer[] = People.map((name, index) => ({
    id: `bench-player-${index + 1}`,
    name,
    avatarUrl: `/avatars/${(index + 1).toString(16).padStart(32, '0')}.svg`,
    isGuest: false,
    isSpectator: false,
}));

const [arnaud, camille, theo, ines, malik, sofia, lucas, nadia] = players;

const Fibonacci = [
    '0',
    '1',
    '2',
    '3',
    '5',
    '8',
    '13',
    '21',
    '34',
    '55',
    '89',
    '?',
    '☕',
];

const SilentChannel: WhisperChannel = {
    whisper: () => undefined,
    listen: () => undefined,
    stopListening: () => undefined,
};

function jiraTask(
    position: number,
    key: string,
    title: string,
    overrides: Partial<PokerTask> = {},
): PokerTask {
    return {
        id: `bench-task-${position}`,
        title,
        description: null,
        descriptionHtml: '',
        acceptanceCriteriaHtml: '',
        position,
        estimate: null,
        estimatedAt: null,
        roundsCount: 0,
        votesCount: 0,
        external: {
            source: 'jira',
            key,
            url: '/dev/design-system/poker-room',
            type: null,
            labels: [],
            isManaged: true,
        },
        ...overrides,
    };
}

const StoryHtml =
    '<p>As a facilitator, I want to export the action items of one or several retros as CSV (title, owner, due date, status, linked ticket) to share them with management.</p>';

function queue(current: Partial<PokerTask>): PokerTask[] {
    return [
        jiraTask(1, 'ATLAS-1284', 'Filter sessions by team', {
            estimate: '3',
            roundsCount: 1,
            votesCount: 7,
        }),
        jiraTask(2, 'ATLAS-1285', 'Email reminders for late action items', {
            estimate: '8',
            roundsCount: 1,
            votesCount: 7,
        }),
        jiraTask(3, 'ATLAS-1287', 'CSV export of retro action items', {
            description: 'As a facilitator…',
            descriptionHtml: StoryHtml,
            acceptanceCriteriaHtml: '',
            ...current,
        }),
        jiraTask(4, 'ATLAS-1288', 'Slack webhook when a retro closes'),
        jiraTask(5, 'ATLAS-1290', 'Dark theme for anonymous guests'),
        jiraTask(6, 'ATLAS-1291', 'Limit votes per card'),
    ];
}

function round(overrides: Partial<PokerRound>): PokerRound {
    return {
        id: 'bench-round',
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

function snapshot(
    overrides: Partial<Omit<PokerSnapshot, 'game' | 'me'>> & {
        game?: Partial<PokerSnapshot['game']>;
        me?: Partial<PokerSnapshot['me']>;
    },
): PokerSnapshot {
    const { game, me, ...rest } = overrides;

    return {
        game: {
            id: 'bench-game',
            title: 'Sprint 43 refinement',
            deck: 'fibonacci',
            deckLabel: 'Fibonacci',
            cards: Fibonacci,
            isNumeric: true,
            facilitatorPlayerId: arnaud.id,
            guestAccessEnabled: false,
            guestUrl: null,
            joinCode: null,
            endedAt: null,
            currentTaskId: 'bench-task-3',
            tasksCount: 6,
            estimatedCount: 2,
            totalPoints: 11,
            hasVotes: true,
            autoReveal: true,
            anonymousVotes: false,
            cursorsEnabled: false,
            reactionsEnabled: true,
            revoteAfterReveal: false,
            taskTimerSeconds: null,
            writesEstimates: true,
            estimateFieldId: null,
            teamName: 'Atlas',
            ...game,
        },
        me: {
            playerId: arnaud.id,
            userId: 'bench-user',
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
        players,
        tasks: queue({ roundsCount: 1 }),
        current: null,
        team: { id: 'bench-team', workspace: 'bench' },
        links: { team: '/dev/design-system' },
        share: {} as PokerSnapshot['share'],
        deliveries: [],
        integrations: null,
        viewerIsObserver: false,
        serverTime: '2026-10-02T09:00:00Z',
        ...rest,
    };
}

/** ScreenPokerBefore: the facilitator plays, seven of eight have voted. */
const voting = snapshot({
    current: {
        taskId: 'bench-task-3',
        round: round({
            votesCount: 7,
            myVote: '5',
            votes: [arnaud, camille, theo, ines, malik, sofia, lucas].map(
                (player) => ({
                    playerId: player.id,
                    value: player.id === arnaud.id ? '5' : null,
                }),
            ),
        }),
    },
});

/** ScreenPokerQueue: the facilitator watches, round 2 is revealed. */
const revealed = snapshot({
    me: { isSpectator: true, canVote: false },
    players: players.map((player) =>
        player.id === arnaud.id ? { ...player, isSpectator: true } : player,
    ),
    tasks: queue({ roundsCount: 2 }),
    current: {
        taskId: 'bench-task-3',
        round: round({
            number: 2,
            revealedAt: '2026-10-02T09:05:00Z',
            revealReason: 'everyone_voted',
            votesCount: 7,
            votes: [
                { playerId: camille.id, value: '5' },
                { playerId: theo.id, value: '5' },
                { playerId: ines.id, value: '8' },
                { playerId: malik.id, value: '13' },
                { playerId: sofia.id, value: '5' },
                { playerId: lucas.id, value: '3' },
                { playerId: nadia.id, value: '?' },
            ],
            result: {
                average: 6.5,
                median: 5,
                spread: { min: 3, max: 13 },
                agreement: 0.5,
                outliers: { low: [lucas.id], high: [malik.id] },
                mode: ['5'],
                consensus: false,
                nearestCard: '5',
                distribution: [
                    { value: '3', count: 1 },
                    { value: '5', count: 3 },
                    { value: '8', count: 1 },
                    { value: '13', count: 1 },
                    { value: '?', count: 1 },
                ],
            },
        }),
    },
});

/** The estimate was saved and written to Jira, then changed there: the facilitator decides. */
const changedInSource = snapshot({
    tasks: queue({
        roundsCount: 2,
        estimate: '5',
        external: {
            source: 'jira',
            key: 'ATLAS-1287',
            url: '/dev/design-system/poker-room',
            type: null,
            labels: [],
            isManaged: true,
            assignee: 'Camille Roux',
            sourceEstimate: '8',
            syncState: 'synced',
            status: 'In Progress',
            statusCategory: 'in_progress',
            estimateConflict: { sourceEstimate: '8', matchingCard: '8' },
        },
    }).map((task) =>
        task.estimate !== null && task.external && task.position < 3
            ? {
                  ...task,
                  external: { ...task.external, statusCategory: 'done' },
              }
            : task,
    ),
    current: revealed.current,
});

/** A participant between two tasks: nothing to vote on yet. */
const waiting = snapshot({
    game: { facilitatorPlayerId: camille.id, autoReveal: false },
    me: {
        playerId: theo.id,
        isFacilitator: false,
        canDelete: false,
        canTakeControl: true,
    },
    current: null,
});

/** Round 1 of the story of ScreenPokerQueue, voted again since. */
const firstRound = round({
    id: 'bench-round-1',
    revealedAt: '2026-10-02T09:02:00Z',
    revealReason: 'manual',
    votesCount: 7,
    votes: [
        { playerId: camille.id, value: '2' },
        { playerId: theo.id, value: '3' },
        { playerId: ines.id, value: '5' },
        { playerId: malik.id, value: '13' },
        { playerId: sofia.id, value: '8' },
        { playerId: lucas.id, value: '13' },
        { playerId: nadia.id, value: '☕' },
    ],
    result: {
        average: 7.3,
        mode: ['13'],
        consensus: false,
        nearestCard: '8',
        distribution: [
            { value: '2', count: 1 },
            { value: '3', count: 1 },
            { value: '5', count: 1 },
            { value: '8', count: 1 },
            { value: '13', count: 2 },
            { value: '☕', count: 1 },
        ],
    },
});

/** The rounds the bench lists under "Rounds (n)": the one on the table, and the first when it was voted again. */
function roundsOf(source: PokerSnapshot): PokerRound[] {
    const current = source.current?.round;

    if (!current) {
        return [];
    }

    return current.number > 1 ? [firstRound, current] : [current];
}

function online(source: PokerSnapshot): PresenceMember[] {
    return source.players.map((player) => ({
        id: player.id,
        name: player.name,
        avatarUrl: player.avatarUrl,
        isGuest: player.isGuest,
    }));
}

const noop = (): void => {};

function BenchRoom({ source }: { source: PokerSnapshot }) {
    const ctx: GameContextValue = {
        snapshot: source,
        dispatch: noop,
        apply: noop,
        run: async () => undefined,
        handleError: () => null,
        refetch: async () => {},
        sessionExpired: false,
        online: online(source),
        presence: SilentChannel,
        serverOffset: 0,
        deckOptions: [],
        loadRounds: async () => roundsOf(source),
    };

    return (
        <GameProvider value={ctx}>
            <RoomView connected reconnecting={false} />
        </GameProvider>
    );
}

export default function PokerRoomSection() {
    return (
        <div className="flex flex-col">
            <div data-slot="poker-room-bench" data-state="voting">
                <BenchRoom source={voting} />
            </div>
            <div data-slot="poker-room-bench" data-state="revealed">
                <BenchRoom source={revealed} />
            </div>
            <div data-slot="poker-room-bench" data-state="changed-in-source">
                <BenchRoom source={changedInSource} />
            </div>
            <div data-slot="poker-room-bench" data-state="waiting">
                <BenchRoom source={waiting} />
            </div>
        </div>
    );
}
