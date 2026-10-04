import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { GamesLeaderboard } from '@/components/skrum/games-leaderboard';
import type {
    GamesRoom,
    NewGameRoomErrors,
    NewGameRoomValues,
} from '@/components/skrum/games-leaderboard';
import { useTrans } from '@/hooks/use-trans';
import type {
    GameLeaderboardPeriod,
    GameOption,
    GameRoomSummary,
    TeamGameLeaderboardRow,
    WorkspaceSummary,
} from '@/types';
import { useTeamGamesChannel } from './use-team-games-channel';

export type TeamGamesProps = {
    workspace: WorkspaceSummary;
    team: { id: string; name: string };
    rooms: GameRoomSummary[];
    gameOptions: GameOption[];
    canCreate: boolean;
    roomLimit: number;
    period: GameLeaderboardPeriod;
    leaderboard?: TeamGameLeaderboardRow[];
};

const ClockTickMs = 30_000;
const MinuteMs = 60_000;
const MinutesPerHour = 60;

/** The current time, refreshed while `running`, for "started n min ago". */
function useClock(running: boolean): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!running) {
            return;
        }

        setNow(Date.now());

        const tick = window.setInterval(() => setNow(Date.now()), ClockTickMs);

        return () => window.clearInterval(tick);
    }, [running]);

    return now;
}

export function TeamGames({
    workspace,
    team,
    rooms: serverRooms,
    gameOptions,
    canCreate,
    roomLimit,
    period,
    leaderboard,
}: TeamGamesProps) {
    const { t } = useTrans();
    const page = usePage();
    const [createErrors, setCreateErrors] = useState<NewGameRoomErrors>({});
    const [creating, setCreating] = useState(false);
    const [leaderboardLoading, setLeaderboardLoading] = useState(false);
    const trackLeaderboard = {
        onStart: () => setLeaderboardLoading(true),
        onFinish: () => setLeaderboardLoading(false),
    };
    const reloadLeaderboard = (): void => {
        router.reload({ only: ['leaderboard'] });
    };
    const { rooms, realtime } = useTeamGamesChannel(team.id, serverRooms, {
        onRoundEnded: reloadLeaderboard,
        onRoomDeleted: () => {
            if (!canCreate) {
                router.reload({ only: ['canCreate'] });
            }
        },
        onResubscribed: () => {
            router.reload({ only: ['rooms', 'canCreate', 'leaderboard'] });
        },
    });
    const now = useClock(rooms.some((room) => room.status === 'playing'));

    const startedLabel = (startedAt: string): string => {
        const minutes = Math.floor(
            Math.max(0, now - Date.parse(startedAt)) / MinuteMs,
        );

        if (minutes < 1) {
            return t('started just now');
        }

        if (minutes < MinutesPerHour) {
            return t('started :count min ago', { count: minutes });
        }

        return t('started :count h ago', {
            count: Math.floor(minutes / MinutesPerHour),
        });
    };

    const listedRooms: GamesRoom[] = rooms.map((room) => ({
        id: room.id,
        name: room.name,
        game: room.game,
        access: room.access,
        playersCount: room.playersCount,
        roundsCount: room.roundsCount,
        href: GameRoomsController.show.url(room.id),
        status: room.status === 'playing' ? 'live' : 'waiting',
        players: room.players.map((player) => ({
            name: player.name,
            avatarUrl: player.avatarUrl,
        })),
        context:
            room.status === 'playing' && room.roundStartedAt !== null
                ? startedLabel(room.roundStartedAt)
                : undefined,
    }));

    const createRoom = (values: NewGameRoomValues): Promise<boolean> =>
        new Promise((resolve) => {
            setCreating(true);
            setCreateErrors({});

            router.post(
                TeamGameRoomsController.store.url({
                    workspace: workspace.slug,
                    team: team.id,
                }),
                values,
                {
                    onSuccess: () => resolve(true),
                    onError: (errors) => {
                        setCreateErrors(errors);
                        resolve(false);
                    },
                    onFinish: () => {
                        setCreating(false);
                        resolve(false);
                    },
                },
            );
        });

    return (
        <div
            data-slot="team-games"
            data-realtime={realtime}
            className="min-w-0"
        >
            <GamesLeaderboard
                rooms={listedRooms}
                gameOptions={gameOptions}
                period={period}
                onPeriodChange={(next) =>
                    router.reload({
                        data: { period: next },
                        only: ['period', 'leaderboard'],
                        ...trackLeaderboard,
                    })
                }
                leaderboard={leaderboard?.map((row) => ({
                    userId: row.userId,
                    name: row.name,
                    avatarUrl: row.avatarUrl,
                    points: row.points,
                    wins: row.wins,
                    roundsPlayed: row.roundsPlayed,
                    streak: row.streak,
                }))}
                leaderboardError={page.rescuedProps?.includes('leaderboard')}
                leaderboardLoading={leaderboardLoading}
                onRetryLeaderboard={() =>
                    router.reload({
                        only: ['leaderboard'],
                        ...trackLeaderboard,
                    })
                }
                currentUserId={page.props.auth.user?.id}
                canCreateRoom={canCreate && rooms.length < roomLimit}
                roomLimit={roomLimit}
                onCreateRoom={createRoom}
                createErrors={createErrors}
                creatingRoom={creating}
                teamName={team.name}
                backHref={TeamsController.show.url({
                    workspace: workspace.slug,
                    team: team.id,
                })}
            />
        </div>
    );
}
