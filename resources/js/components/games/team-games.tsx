import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Leaderboard } from '@/components/skrum/games-leaderboard';
import type {
    GameLeaderboardPeriod,
    GameRoomSummary,
    TeamGameLeaderboardRow,
    WorkspaceSummary,
} from '@/types';
import { useTeamGamesChannel } from './use-team-games-channel';

export type TeamGamesProps = {
    workspace: WorkspaceSummary;
    team: { id: string; name: string };
    period: GameLeaderboardPeriod;
    leaderboard?: TeamGameLeaderboardRow[];
};

/** The page lists no room: the channel tells of each one, to hear when a round ends. */
const NoRooms: GameRoomSummary[] = [];

/** The games tab of Insights: the leaderboard of the team, reloaded when a round ends. */
export function TeamGames({ team, period, leaderboard }: TeamGamesProps) {
    const page = usePage();
    const [leaderboardLoading, setLeaderboardLoading] = useState(false);
    const trackLeaderboard = {
        onStart: () => setLeaderboardLoading(true),
        onFinish: () => setLeaderboardLoading(false),
    };
    const reloadLeaderboard = (): void => {
        router.reload({ only: ['leaderboard'] });
    };
    const { realtime } = useTeamGamesChannel(team.id, NoRooms, {
        onRoundEnded: reloadLeaderboard,
        onResubscribed: reloadLeaderboard,
    });

    return (
        <div
            data-slot="team-games"
            data-realtime={realtime}
            className="max-w-3xl min-w-0"
        >
            <Leaderboard
                period={period}
                onPeriodChange={(next) =>
                    router.reload({
                        data: { period: next },
                        only: ['period', 'leaderboard'],
                        ...trackLeaderboard,
                    })
                }
                entries={leaderboard?.map((row) => ({
                    userId: row.userId,
                    name: row.name,
                    avatarUrl: row.avatarUrl,
                    points: row.points,
                    wins: row.wins,
                    gamesPlayed: row.gamesPlayed,
                    streak: row.streak,
                }))}
                error={page.rescuedProps?.includes('leaderboard')}
                loading={leaderboardLoading}
                onRetry={() =>
                    router.reload({
                        only: ['leaderboard'],
                        ...trackLeaderboard,
                    })
                }
                currentUserId={page.props.auth.user?.id}
            />
        </div>
    );
}
