<?php

namespace App\Actions\Games;

use App\Models\GamePoint;
use App\Models\Team;
use App\Models\User;

/**
 * Members only (spec §4.7): guests have no identity across rooms, removed
 * members and workspace admins outside the team are not part of it, and a
 * deleted user's rows lost their user id.
 */
class TeamGameLeaderboard
{
    public const Periods = ['30d', 'all'];

    public const DefaultPeriod = '30d';

    public const Size = 20;

    public function __construct(private GameStreaks $gameStreaks) {}

    public static function period(mixed $value): string
    {
        return in_array($value, self::Periods, true) ? $value : self::DefaultPeriod;
    }

    /**
     * @return array<int, array{
     *     userId: string,
     *     name: string,
     *     avatarUrl: string,
     *     points: int,
     *     wins: int,
     *     roundsPlayed: int,
     *     streak: int
     * }>
     */
    public function handle(Team $team, string $period): array
    {
        $rows = GamePoint::query()
            ->join('users', 'users.id', '=', 'game_points.user_id')
            ->where('game_points.team_id', $team->id)
            ->whereIn('game_points.user_id', $team->members()->select('users.id'))
            ->when($period === '30d', fn ($query) => $query->where('game_points.created_at', '>=', now()->subDays(30)))
            ->groupBy('game_points.user_id', 'users.name')
            ->selectRaw('game_points.user_id, users.name, sum(game_points.points) as total_points, sum(case when game_points.is_win then 1 else 0 end) as wins, count(*) as rounds_played')
            ->orderByDesc('total_points')
            ->orderByDesc('wins')
            ->orderByRaw('lower(users.name)')
            ->orderBy('users.name')
            ->limit(self::Size)
            ->toBase()
            ->get();

        $userIds = $rows->map(fn (object $row): string => (string) $row->user_id)->all();
        $users = User::query()->whereKey($userIds)->get()->keyBy('id');
        $streaks = $this->gameStreaks->forUsers($team, $userIds);

        return $rows
            ->map(fn (object $row): array => [
                'userId' => (string) $row->user_id,
                'name' => (string) $row->name,
                'avatarUrl' => $users->get((string) $row->user_id)?->avatarUrl() ?? '',
                'points' => (int) $row->total_points,
                'wins' => (int) $row->wins,
                'roundsPlayed' => (int) $row->rounds_played,
                'streak' => $streaks[(string) $row->user_id] ?? 0,
            ])
            ->values()
            ->all();
    }
}
