<?php

namespace App\Http\Controllers;

use App\Http\Requests\Teams\TeamSprintRequest;
use App\Models\Team;
use App\Models\TeamSprint;
use App\Models\Workspace;
use App\Support\Database\Transactions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class TeamSprintsController extends Controller
{
    public function store(TeamSprintRequest $request, Workspace $workspace, Team $team): RedirectResponse
    {
        $this->save($team, null, $request->sprint());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sprint added.')]);

        return back();
    }

    public function update(TeamSprintRequest $request, Workspace $workspace, Team $team, TeamSprint $sprint): RedirectResponse
    {
        $this->save($team, $sprint, $request->sprint());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sprint saved.')]);

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, TeamSprint $sprint): RedirectResponse
    {
        Gate::authorize('manageRituals', $team);

        $sprint->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sprint deleted.')]);

        return back();
    }

    /**
     * Number and days are checked under the team's lock, so that two saves never
     * leave two sprints sharing a number or a day (spec §6.3, rules 1 and 2).
     *
     * @param  array{number: int, starts_on: string, ends_on: string}  $attributes
     */
    private function save(Team $team, ?TeamSprint $sprint, array $attributes): void
    {
        DB::transaction(function () use ($team, $sprint, $attributes): void {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            if ($this->otherSprints($locked, $sprint)->where('number', $attributes['number'])->exists()) {
                throw ValidationException::withMessages(['number' => __('Sprint :number already exists.', ['number' => $attributes['number']])]);
            }

            $overlap = $this->otherSprints($locked, $sprint)
                ->where('starts_on', '<=', $attributes['ends_on'])
                ->where('ends_on', '>=', $attributes['starts_on'])
                ->oldest('starts_on')
                ->orderBy('id')
                ->first();

            if ($overlap !== null) {
                throw ValidationException::withMessages(['starts_on' => __('This sprint overlaps Sprint :number (:start – :end).', [
                    'number' => $overlap->number,
                    'start' => $overlap->starts_on->isoFormat('D MMM'),
                    'end' => $overlap->ends_on->isoFormat('D MMM'),
                ])]);
            }

            if ($sprint === null) {
                $locked->sprints()->create($attributes);

                return;
            }

            $sprint->update($attributes);
        }, Transactions::Attempts);
    }

    /**
     * @return Builder<TeamSprint>
     */
    private function otherSprints(Team $team, ?TeamSprint $sprint): Builder
    {
        $query = TeamSprint::query()->where('team_id', $team->id);

        if ($sprint === null) {
            return $query;
        }

        return $query->whereKeyNot($sprint->id);
    }
}
