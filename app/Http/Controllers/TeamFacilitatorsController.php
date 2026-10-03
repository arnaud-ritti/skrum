<?php

namespace App\Http\Controllers;

use App\Enums\TeamRole;
use App\Http\Requests\Teams\TeamFacilitatorsRequest;
use App\Models\Team;
use App\Models\TeamMembership;
use App\Models\Workspace;
use App\Support\Database\Transactions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class TeamFacilitatorsController extends Controller
{
    public function update(TeamFacilitatorsRequest $request, Workspace $workspace, Team $team): RedirectResponse
    {
        $userIds = $request->userIds();
        $rotation = $request->boolean('rotation');

        DB::transaction(function () use ($team, $userIds, $rotation): void {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            $eligible = TeamMembership::query()
                ->where('team_id', $locked->id)
                ->whereIn('user_id', $userIds)
                ->whereIn('role', [TeamRole::Owner->value, TeamRole::Facilitator->value])
                ->count();

            if ($eligible !== count($userIds)) {
                throw ValidationException::withMessages(['user_ids' => __('Only owners and facilitators of the team can be suggested.')]);
            }

            if ($rotation && $userIds === []) {
                throw ValidationException::withMessages(['rotation' => __('Add a facilitator first.')]);
            }

            $current = $locked->defaultFacilitators()->pluck('users.id')->all();

            $locked->defaultFacilitators()->sync(
                collect($userIds)->mapWithKeys(fn (string $id, int $position): array => [$id => ['position' => $position]])->all(),
            );

            $locked->update([
                'facilitator_rotation_enabled' => $rotation,
                'rotation_position' => $current === $userIds ? $locked->rotation_position : 0,
            ]);
        }, Transactions::Attempts);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Facilitators saved.')]);

        return back();
    }
}
