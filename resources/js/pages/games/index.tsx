import { Head, Link } from '@inertiajs/react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { NewRoomDialog } from '@/components/games/new-room-dialog';
import { RoomCard } from '@/components/games/room-card';
import { TeamLeaderboard } from '@/components/games/team-leaderboard';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type {
    GameLeaderboardPeriod,
    GameOption,
    GameRoomSummary,
    TeamGameLeaderboardRow,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    rooms: GameRoomSummary[];
    gameOptions: GameOption[];
    canCreate: boolean;
    roomLimit: number;
    period: GameLeaderboardPeriod;
    leaderboard?: TeamGameLeaderboardRow[];
};

export default function GamesIndex({
    workspace,
    team,
    rooms,
    gameOptions,
    canCreate,
    roomLimit,
    period,
    leaderboard,
}: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Games')} />
            <div className="max-w-4xl space-y-8 p-4">
                <Heading
                    title={t('Games')}
                    description={t('Short games to warm up :team.', {
                        team: team.name,
                    })}
                />

                <div className="flex flex-wrap items-center gap-2">
                    {canCreate && (
                        <NewRoomDialog
                            workspaceSlug={workspace.slug}
                            teamId={team.id}
                            gameOptions={gameOptions}
                        />
                    )}
                    <Button variant="outline" asChild>
                        <Link
                            href={TeamsController.show({
                                workspace: workspace.slug,
                                team: team.id,
                            })}
                        >
                            {t('Back to the team')}
                        </Link>
                    </Button>
                    {!canCreate && rooms.length >= roomLimit && (
                        <p className="text-sm text-muted-foreground">
                            {t('This team already has :count game rooms.', {
                                count: roomLimit,
                            })}
                        </p>
                    )}
                </div>

                <section className="space-y-3">
                    <Heading variant="small" title={t('Rooms')} />
                    {rooms.length === 0 ? (
                        <p className="text-muted-foreground">
                            {t('No game rooms yet.')}
                        </p>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {rooms.map((room) => (
                                <RoomCard key={room.id} room={room} />
                            ))}
                        </div>
                    )}
                </section>

                <TeamLeaderboard leaderboard={leaderboard} period={period} />
            </div>
        </>
    );
}
