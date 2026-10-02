import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    GamesLeaderboard,
    Leaderboard,
} from '@/components/skrum/games-leaderboard';
import type {
    GameLeaderboardPeriod,
    GameOption,
    GamesLeaderboardEntry,
    GamesRoom,
} from '@/components/skrum/games-leaderboard';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

const gameOptions: GameOption[] = [
    { value: 'hangman', label: 'Hangman', available: true },
    { value: 'draw', label: 'Draw & Guess', available: true },
    { value: 'gif', label: 'Sprint in one GIF', available: true },
    { value: 'decoded', label: 'Decoded', available: true },
];

const names = [
    'Malik',
    'Inès',
    'Camille',
    'Théo',
    'Sofia',
    'Arnaud',
    'Yuki',
    'Noor',
    'Léa',
    'Omar',
];

function makeEntries(count: number): GamesLeaderboardEntry[] {
    return Array.from({ length: count }, (_, index) => ({
        userId: `u${index + 1}`,
        name: `${names[index % names.length]}${index >= names.length ? ` ${index + 1}` : ''}`,
        avatarUrl: null,
        presence: ((index % 12) + 1) as GamesLeaderboardEntry['presence'],
        points: 1500 - index * 7,
        wins: Math.max(0, 5 - index),
        roundsPlayed: 12 - (index % 8),
        streak: index === 4 ? 3 : 0,
    }));
}

function makeRooms(): GamesRoom[] {
    const players = names.slice(0, 5).map((name, index) => ({
        name,
        presence: ((index % 12) + 1) as 1,
    }));

    return [
        {
            id: 'a',
            name: 'Friday fun',
            game: 'decoded',
            access: 'team',
            playersCount: 7,
            roundsCount: 9,
            href: '#',
            status: 'finished',
            players,
        },
        {
            id: 'b',
            name: 'Sprint 43 kick-off',
            game: 'draw',
            access: 'link',
            playersCount: 2,
            roundsCount: 0,
            href: '#',
            status: 'waiting',
            minPlayers: 3,
            players: players.slice(0, 2),
        },
        {
            id: 'c',
            name: 'Daily warm-up',
            game: 'hangman',
            access: 'team',
            playersCount: 5,
            roundsCount: 3,
            href: '#',
            status: 'live',
            players,
        },
        {
            id: 'd',
            name: 'Retro icebreaker with a very long name that must truncate inside the card',
            game: 'gif',
            access: 'team',
            playersCount: 4,
            roundsCount: 1,
            href: '#',
            status: 'live',
            players: players.slice(0, 4),
        },
    ];
}

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Page({
    rooms,
    leaderboard,
    initialPeriod = '30d',
    currentUserId,
    canCreateRoom = true,
    loading,
    error,
}: {
    rooms: GamesRoom[];
    leaderboard?: GamesLeaderboardEntry[];
    initialPeriod?: GameLeaderboardPeriod;
    currentUserId?: string;
    canCreateRoom?: boolean;
    loading?: boolean;
    error?: boolean;
}) {
    const [period, setPeriod] = useState(initialPeriod);

    return (
        <GamesLeaderboard
            teamName="Atlas"
            backHref="#"
            rooms={rooms}
            gameOptions={gameOptions}
            canCreateRoom={canCreateRoom}
            roomLimit={20}
            onCreateRoom={noop}
            period={period}
            onPeriodChange={setPeriod}
            leaderboard={leaderboard}
            leaderboardLoading={loading}
            leaderboardError={error}
            onRetryLeaderboard={noop}
            currentUserId={currentUserId}
        />
    );
}

export default function GamesLeaderboardSection() {
    const { t } = useTrans();
    const rooms = makeRooms();

    return (
        <div className="flex flex-col gap-10 p-4 md:p-6">
            <Example
                label={t(
                    'Rooms live, waiting and finished, leaderboard with me in the list (switch the period)',
                )}
            >
                <Page
                    rooms={rooms}
                    leaderboard={makeEntries(8)}
                    currentUserId="u6"
                />
            </Example>
            <Example label={t('Me on the podium, all time')}>
                <Page
                    rooms={rooms.slice(2, 3)}
                    leaderboard={makeEntries(5)}
                    currentUserId="u1"
                    initialPeriod="all"
                />
            </Example>
            <Example label={t('Fewer than 3 players')}>
                <Leaderboard
                    period="30d"
                    onPeriodChange={noop}
                    entries={makeEntries(2)}
                    currentUserId="u2"
                />
            </Example>
            <Example label={t('Empty rooms and empty leaderboard')}>
                <Page rooms={[]} leaderboard={[]} initialPeriod="all" />
            </Example>
            <Example label={t('Leaderboard loading')}>
                <Leaderboard period="30d" onPeriodChange={noop} />
            </Example>
            <Example label={t('Leaderboard failed to load')}>
                <Leaderboard
                    period="30d"
                    onPeriodChange={noop}
                    error
                    onRetry={noop}
                />
            </Example>
            <Example label={t('Team cannot create rooms (limit reached)')}>
                <Page
                    rooms={rooms}
                    leaderboard={makeEntries(4)}
                    canCreateRoom={false}
                />
            </Example>
            <Example label={t('One player')}>
                <Leaderboard
                    period="30d"
                    onPeriodChange={noop}
                    entries={makeEntries(1)}
                />
            </Example>
            <Example label={t('200 players, scrolling inside the card')}>
                <Leaderboard
                    period="all"
                    onPeriodChange={noop}
                    entries={makeEntries(200)}
                    currentUserId="u120"
                />
            </Example>
            <Example label={t('200 rooms')}>
                <Page
                    rooms={Array.from({ length: 200 }, (_, index) => ({
                        ...rooms[index % rooms.length],
                        id: `r${index}`,
                        name: `Room ${index + 1}`,
                    }))}
                    leaderboard={makeEntries(3)}
                />
            </Example>
        </div>
    );
}
