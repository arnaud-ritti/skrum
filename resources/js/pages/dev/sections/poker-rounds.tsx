import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { PokerRounds } from '@/components/skrum/poker-rounds';
import { useTrans } from '@/hooks/use-trans';
import type { PokerRound } from '@/lib/poker/types';

export const group: BenchGroup = 'skrum';

const players = [
    { id: 'p1', name: 'Camille' },
    { id: 'p2', name: 'Théo' },
    { id: 'p3', name: 'Malik' },
    { id: 'p4', name: 'Sofia' },
    { id: 'p5', name: 'Yuki' },
];

function round(overrides: Partial<PokerRound>): PokerRound {
    return {
        id: 'r1',
        number: 1,
        anonymous: false,
        revealedAt: '2026-10-02T09:00:00Z',
        revealReason: 'manual',
        timerEndsAt: null,
        version: 1,
        votesCount: 5,
        votes: [],
        myVote: null,
        result: null,
        ...overrides,
    };
}

const spreadRound = round({
    id: 'r1',
    number: 1,
    votes: [
        { playerId: 'p1', value: '3' },
        { playerId: 'p2', value: '5' },
        { playerId: 'p3', value: '5' },
        { playerId: 'p4', value: '8' },
        { playerId: 'gone', value: '13' },
    ],
    result: {
        average: 6.8,
        mode: ['5'],
        consensus: false,
        nearestCard: '8',
        distribution: [
            { value: '3', count: 1 },
            { value: '5', count: 2 },
            { value: '8', count: 1 },
            { value: '13', count: 1 },
        ],
    },
});

const consensusRound = round({
    id: 'r2',
    number: 2,
    votes: players.map((player) => ({ playerId: player.id, value: '5' })),
    result: {
        average: 5,
        mode: ['5'],
        consensus: true,
        nearestCard: '5',
        distribution: [{ value: '5', count: 5 }],
    },
});

const anonymousRound = round({
    id: 'r3',
    number: 3,
    anonymous: true,
    votes: players.map((player) => ({ playerId: player.id, value: null })),
    result: {
        average: 6,
        mode: ['5'],
        consensus: false,
        nearestCard: '5',
        distribution: [
            { value: '3', count: 1 },
            { value: '5', count: 3 },
            { value: '13', count: 1 },
        ],
    },
});

const pendingRound = round({
    id: 'r4',
    number: 4,
    revealedAt: null,
    votesCount: 2,
});

const shirtRound = round({
    id: 'r5',
    number: 1,
    votesCount: 4,
    votes: [
        { playerId: 'p1', value: 'M' },
        { playerId: 'p2', value: 'M' },
        { playerId: 'p3', value: 'XL' },
        { playerId: 'p4', value: '?' },
    ],
    result: {
        average: null,
        mode: ['M'],
        consensus: false,
        nearestCard: null,
        distribution: [
            { value: 'M', count: 2 },
            { value: 'XL', count: 1 },
            { value: '?', count: 1 },
        ],
    },
});

const abstainRound = round({
    id: 'r6',
    number: 2,
    votesCount: 2,
    votes: [
        { playerId: 'p1', value: '?' },
        { playerId: 'p2', value: '☕' },
    ],
    result: {
        average: null,
        mode: [],
        consensus: false,
        nearestCard: null,
        distribution: [
            { value: '?', count: 1 },
            { value: '☕', count: 1 },
        ],
    },
});

const crowd = Array.from({ length: 13 }, (_, index) => ({
    id: `c${index}`,
    name:
        index === 0
            ? 'Maximilienne-Alexandrine de La Rochefoucauld-Montmorency'
            : `Guest ${index}`,
}));

const crowdRounds = Array.from({ length: 200 }, (_, index) =>
    round({
        id: `many-${index}`,
        number: 200 - index,
        votesCount: 13,
        votes: crowd.map((voter, position) => ({
            playerId: voter.id,
            value: position % 4 === 0 ? 'XXL-size' : '8',
        })),
        result: {
            average: null,
            mode: ['8'],
            consensus: false,
            nearestCard: null,
            distribution: [
                { value: '8', count: 9 },
                { value: 'XXL-size', count: 4 },
            ],
        },
    }),
);

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
                {children}
            </div>
        </div>
    );
}

export default function PokerRoundsSection() {
    const { t } = useTrans();
    const namedCrowd = crowd.map((voter, index) =>
        index === 0
            ? voter
            : { ...voter, name: t('Guest :number', { number: index }) },
    );

    return (
        <div className="flex max-w-240 flex-col gap-8 p-4 md:p-6">
            <Example
                label={t('Collapsed (default once the task is estimated)')}
            >
                <PokerRounds
                    rounds={[consensusRound, spreadRound]}
                    players={players}
                />
            </Example>
            <Example
                label={t(
                    'Open: consensus, then a spread with a player who left the game',
                )}
            >
                <PokerRounds
                    rounds={[consensusRound, spreadRound]}
                    players={players}
                    defaultOpen
                />
            </Example>
            <Example
                label={t(
                    'Open: round in progress (not revealed) and an anonymous round (values only, deck order)',
                )}
            >
                <PokerRounds
                    rounds={[pendingRound, anonymousRound]}
                    players={players}
                    defaultOpen
                />
            </Example>
            <Example
                label={t(
                    'Open: non-numeric deck (most played) and a round without a countable vote',
                )}
            >
                <PokerRounds
                    rounds={[abstainRound, shirtRound]}
                    players={players}
                    isNumeric={false}
                    defaultOpen
                />
            </Example>
            <Example label={t('Open: no round yet')}>
                <PokerRounds rounds={[]} defaultOpen />
            </Example>
            <Example label={t('Open: one round')}>
                <PokerRounds
                    rounds={[consensusRound]}
                    players={players}
                    defaultOpen
                />
            </Example>
            <Example label={t('Open: loading (the count comes from the task)')}>
                <PokerRounds
                    rounds={[]}
                    count={2}
                    status="loading"
                    defaultOpen
                />
            </Example>
            <Example label={t('Open: loading failed')}>
                <PokerRounds
                    rounds={[]}
                    count={2}
                    status="failed"
                    defaultOpen
                />
            </Example>
            <Example
                label={t(
                    '20rem container: 13 voters, an 8-character value and a 60-character name',
                )}
            >
                <div className="w-72 max-w-full">
                    <PokerRounds
                        rounds={crowdRounds.slice(0, 1)}
                        players={namedCrowd}
                        isNumeric={false}
                        defaultOpen
                    />
                </div>
            </Example>
            <Example
                label={t('200 rounds (collapsed; open it to scroll the page)')}
            >
                <PokerRounds
                    rounds={crowdRounds}
                    players={namedCrowd}
                    isNumeric={false}
                />
            </Example>
        </div>
    );
}
