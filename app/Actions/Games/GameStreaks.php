<?php

namespace App\Actions\Games;

use App\Models\GamePoint;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Consecutive ISO weeks (UTC, Monday start) with at least one points row
 * in the team, counted back from this week, or from last week while this
 * week has none yet (spec §4.7). Read as one row per user and week
 * played, from the stored week.
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
            ->select(['user_id', 'week_start'])
            ->distinct()
            ->toBase()
            ->get()
            ->groupBy('user_id')
            ->map(fn ($rows): array => $rows
                ->map(fn (object $row): string => substr((string) $row->week_start, 0, 10))
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
