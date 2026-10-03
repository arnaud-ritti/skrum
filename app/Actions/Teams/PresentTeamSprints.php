<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\TeamSprint;
use App\Support\Teams\SprintCalendar;
use Carbon\CarbonInterface;

class PresentTeamSprints
{
    public const int MaxListed = 52;

    public function __construct(private StartNextSprint $startNextSprint) {}

    /**
     * The latest sprints first (a year of weekly sprints at most), the current one,
     * the next retro, and what "Start the next sprint" would do now.
     *
     * @return array{
     *     list: array<int, array{id: string, number: int, startsOn: string, endsOn: string, isCurrent: bool}>,
     *     total: int,
     *     current: array{id: string, number: int, startsOn: string, endsOn: string}|null,
     *     nextRetro: array{date: string, time: ?string}|null,
     *     nextStart: array{number: int, startsOn: string, endsOn: string, refusal: ?string}
     * }
     */
    public function handle(Team $team, CarbonInterface $now): array
    {
        $calendar = SprintCalendar::fromToday($team, $now);
        $current = $calendar->sprintOn($now);

        $list = TeamSprint::query()
            ->where('team_id', $team->id)
            ->latest('starts_on')
            ->orderByDesc('id')
            ->limit(self::MaxListed)
            ->get()
            ->map(fn (TeamSprint $sprint): array => [...$sprint->present(), 'isCurrent' => $sprint->id === ($current['id'] ?? null)])
            ->values()
            ->all();

        return [
            'list' => $list,
            'total' => $team->sprints()->count(),
            'current' => $current,
            'nextRetro' => $calendar->nextRetro($now),
            'nextStart' => $this->startNextSprint->preview($team, $now),
        ];
    }
}
