<?php

namespace App\Actions\Games;

use App\Models\GamePoint;
use App\Models\GameRound;
use App\Models\Team;
use App\Models\User;
use App\Support\Alphabetical;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

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
     *     gamesPlayed: int,
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
            ->withCount(['gamePoints as wins' => fn (Builder $points) => $inScope($points)->where('is_win', true)])
            ->get()
            ->sort(fn (User $first, User $second): int => [(int) $second->total_points, (int) $second->wins, Alphabetical::key($first->name), $first->name, $first->id]
                <=> [(int) $first->total_points, (int) $first->wins, Alphabetical::key($second->name), $second->name, $second->id])
            ->take(self::Size)
            ->values();

        $streaks = $this->gameStreaks->forUsers($team, $members->modelKeys());
        $gamesPlayed = $this->gamesPlayed($team, $since, $members->modelKeys());

        return $members
            ->map(fn (User $member): array => [
                'userId' => $member->id,
                'name' => $member->name,
                'avatarUrl' => $member->avatarUrl(),
                'points' => (int) $member->total_points,
                'wins' => (int) $member->wins,
                'gamesPlayed' => $gamesPlayed[$member->id] ?? 0,
                'streak' => $streaks[$member->id] ?? 0,
            ])
            ->all();
    }

    /**
     * Spec §6.4: a game runs from a round numbered 1 through the rounds
     * numbered after it in the same room; an unnumbered round, or a point
     * whose round was deleted, is a game of its own.
     *
     * @param  array<int, string>  $userIds
     * @return array<string, int>
     */
    private function gamesPlayed(Team $team, ?CarbonInterface $since, array $userIds): array
    {
        $points = GamePoint::query()
            ->where('team_id', $team->id)
            ->whereIn('user_id', $userIds)
            ->when($since !== null, fn (Builder $recent) => $recent->where('created_at', '>=', $since))
            ->get(['id', 'user_id', 'game_round_id', 'game_room_id']);

        $gameOfRound = $this->gameOfRound($points->whereNotNull('game_round_id')->pluck('game_room_id')->unique()->values()->all());

        return $points->groupBy('user_id')
            ->map(fn (Collection $rows): int => $rows
                ->map(fn (GamePoint $point): string => $gameOfRound[$point->game_round_id] ?? "point-{$point->id}")
                ->unique()
                ->count())
            ->all();
    }

    /**
     * @param  array<int, string>  $roomIds
     * @return array<string, string> the first round of each round's game, by round id
     */
    private function gameOfRound(array $roomIds): array
    {
        $gameOf = [];

        GameRound::query()
            ->whereIn('game_room_id', $roomIds)
            ->oldest('started_at')
            ->orderBy('id')
            ->get(['id', 'game_room_id', 'number'])
            ->groupBy('game_room_id')
            ->each(function (Collection $rounds) use (&$gameOf): void {
                $first = null;

                foreach ($rounds as $round) {
                    if ($first === null || $round->number === null || $round->number === 1) {
                        $first = $round->id;
                    }

                    $gameOf[$round->id] = $first;
                }
            });

        return $gameOf;
    }
}
