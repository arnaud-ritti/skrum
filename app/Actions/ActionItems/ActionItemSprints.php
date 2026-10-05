<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\TeamSprint;
use Illuminate\Support\Collection;

class ActionItemSprints
{
    /**
     * Spec 24 §6.8: the sprint of each row of the page is the sprint of its team that contains
     * the day the row was created. The current sprint of each team on the page
     * is listed too, so that a row created live finds its group before the next reload.
     *
     * @param  iterable<int, ActionItem>  $items
     * @return array{
     *     sprints: array<int, array{id: string, number: int, startsOn: string, endsOn: string, teamId: string, state: string, itemIds: array<int, string>}>,
     *     withoutSprint: array<int, string>
     * }
     */
    public function forPage(iterable $items): array
    {
        $rows = collect($items);

        if ($rows->isEmpty()) {
            return ['sprints' => [], 'withoutSprint' => []];
        }

        $today = ActionItem::today()->toDateString();

        $sprints = TeamSprint::query()
            ->whereIn('team_id', $rows->pluck('team_id')->unique()->values()->all())
            ->where('ends_on', '>=', $rows->map(fn (ActionItem $item): string => $this->createdOn($item))->min())
            ->where('starts_on', '<=', $today)
            ->oldest('starts_on')
            ->orderBy('id')
            ->get();

        $itemIds = $rows
            ->groupBy(fn (ActionItem $item): string => $this->sprintOf($sprints, $item)->id ?? '')
            ->map(fn (Collection $group): array => $group->pluck('id')->values()->all());

        return [
            'sprints' => $sprints
                ->filter(fn (TeamSprint $sprint): bool => $itemIds->has($sprint->id) || $this->state($sprint, $today) === 'current')
                ->reverse()
                ->map(fn (TeamSprint $sprint): array => [
                    ...$sprint->present(),
                    'teamId' => $sprint->team_id,
                    'state' => $this->state($sprint, $today),
                    'itemIds' => $itemIds->get($sprint->id, []),
                ])
                ->values()
                ->all(),
            'withoutSprint' => $itemIds->get('', []),
        ];
    }

    /**
     * @param  Collection<int, TeamSprint>  $sprints
     */
    private function sprintOf(Collection $sprints, ActionItem $item): ?TeamSprint
    {
        $day = $this->createdOn($item);

        return $sprints->first(fn (TeamSprint $sprint): bool => $sprint->team_id === $item->team_id
            && $sprint->starts_on->toDateString() <= $day
            && $sprint->ends_on->toDateString() >= $day);
    }

    /**
     * Only sprints that started are read: one that ended before today is finished.
     */
    private function state(TeamSprint $sprint, string $today): string
    {
        return $sprint->ends_on->toDateString() < $today ? 'finished' : 'current';
    }

    /**
     * The day in the application's time zone, as ActionItem::today() reads today.
     */
    private function createdOn(ActionItem $item): string
    {
        return ($item->created_at ?? now())->timezone((string) config('app.timezone'))->toDateString();
    }
}
