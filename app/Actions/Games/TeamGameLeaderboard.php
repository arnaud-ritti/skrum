<?php

namespace App\Actions\Games;

use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

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
        $since = $period === '30d' ? now()->subDays(30) : null;
        $inScope = fn (Builder $points): Builder => $points
            ->where('team_id', $team->id)
            ->when($since !== null, fn (Builder $recent) => $recent->where('created_at', '>=', $since));

        $members = $team->members()
            ->whereHas('gamePoints', $inScope)
            ->withSum(['gamePoints as total_points' => $inScope], 'points')
            ->withCount(['gamePoints as wins' => fn (Builder $points) => $inScope($points)->where('is_win', true), 'gamePoints as rounds_played' => $inScope])
            ->get()
            ->sort(fn (User $first, User $second): int => [(int) $second->total_points, (int) $second->wins, mb_strtolower($first->name), $first->name, $first->id]
                <=> [(int) $first->total_points, (int) $first->wins, mb_strtolower($second->name), $second->name, $second->id])
            ->take(self::Size)
            ->values();

        $streaks = $this->gameStreaks->forUsers($team, $members->modelKeys());

        return $members
            ->map(fn (User $member): array => [
                'userId' => $member->id,
                'name' => $member->name,
                'avatarUrl' => $member->avatarUrl(),
                'points' => (int) $member->total_points,
                'wins' => (int) $member->wins,
                'roundsPlayed' => (int) $member->rounds_played,
                'streak' => $streaks[$member->id] ?? 0,
            ])
            ->all();
    }
}
