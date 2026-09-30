<?php

namespace App\Actions\Games;

use App\Models\GamePoint;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Consecutive ISO weeks (UTC, Monday start) with at least one points row
 * in the team, counted back from this week, or from last week while this
 * week has none yet (spec §4.7). Read with one grouped query, never stored.
 */
class GameStreaks
{
    /**
     * @param  array<int, string>  $userIds
     * @return array<string, int>
     */
    public function forUsers(Team $team, array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $weeks = GamePoint::query()
            ->where('team_id', $team->id)
            ->whereIn('user_id', $userIds)
            ->selectRaw("user_id, date_trunc('week', created_at) as week_start")
            ->groupByRaw("user_id, date_trunc('week', created_at)")
            ->toBase()
            ->get()
            ->groupBy('user_id')
            ->map(fn ($rows): array => $rows
                ->map(fn (object $row): string => CarbonImmutable::parse((string) $row->week_start, 'UTC')->toDateString())
                ->all());

        $currentWeek = CarbonImmutable::now('UTC')->startOfWeek(CarbonInterface::MONDAY);
        $streaks = [];

        foreach ($userIds as $userId) {
            $streaks[$userId] = $this->streak($weeks->get($userId, []), $currentWeek);
        }

        return $streaks;
    }

    /**
     * @param  array<int, string>  $weekStarts  Monday dates (Y-m-d) with points
     */
    public function streak(array $weekStarts, CarbonImmutable $currentWeek): int
    {
        $played = array_flip($weekStarts);
        $week = isset($played[$currentWeek->toDateString()]) ? $currentWeek : $currentWeek->subWeek();
        $streak = 0;

        while (isset($played[$week->toDateString()])) {
            $streak++;
            $week = $week->subWeek();
        }

        return $streak;
    }
}
