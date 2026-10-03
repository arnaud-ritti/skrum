<?php

namespace App\Http\Controllers;

use App\Actions\Teams\RecordTeamActivity;
use App\Enums\TeamActivityKind;
use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeamMembersController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, RecordTeamActivity $recordTeamActivity): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        $validated = $request->validate([
            'user_id' => [
                'required',
                'uuid',
                Rule::exists('workspace_user', 'user_id')->where('workspace_id', $workspace->id),
            ],
            'role' => ['nullable', Rule::enum(TeamRole::class)],
        ]);

        if ($team->members()->whereKey($validated['user_id'])->exists()) {
            return back();
        }

        DB::transaction(function () use ($team, $validated, $recordTeamActivity): void {
            $team->members()->attach($validated['user_id'], ['role' => $validated['role'] ?? TeamRole::Member->value]);

            $recordTeamActivity->handle($team->id, TeamActivityKind::MemberJoined, User::query()->whereKey($validated['user_id'])->firstOrFail());
        });

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, User $member): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        DB::transaction(function () use ($team, $member): void {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            if ($locked->defaultFacilitators()->detach($member->id) > 0) {
                $locked->update(['rotation_position' => 0]);
            }

            $locked->members()->detach($member->id);
        });

        return back();
    }
}
