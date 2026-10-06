import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Leaderboard } from '@/components/skrum/games-leaderboard';
import type {
    GameLeaderboardPeriod,
    GamesLeaderboardEntry,
} from '@/components/skrum/games-leaderboard';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

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
        gamesPlayed: 12 - (index % 8),
        streak: index === 4 ? 3 : 0,
    }));
}

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Switchable({
    entries,
    initialPeriod = '30d',
    currentUserId,
}: {
    entries: GamesLeaderboardEntry[];
    initialPeriod?: GameLeaderboardPeriod;
    currentUserId?: string;
}) {
    const [period, setPeriod] = useState(initialPeriod);

    return (
        <Leaderboard
            period={period}
            onPeriodChange={setPeriod}
            entries={entries}
            currentUserId={currentUserId}
        />
    );
}

export default function GamesLeaderboardSection() {
    const { t } = useTrans();
    return (
        <div className="flex flex-col gap-10 p-4 md:p-6">
            <Example label={t('Me on the podium, all time')}>
                <Switchable
                    entries={makeEntries(8)}
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
        </div>
    );
}
