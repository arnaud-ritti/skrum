<?php

namespace App\Http\Controllers;

use App\Actions\Games\CreateGameRoom;
use App\Actions\Games\TeamGameLeaderboard;
use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamGameRoomsController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team, TeamGameLeaderboard $teamGameLeaderboard): Response
    {
        Gate::authorize('view', $team);

        $period = TeamGameLeaderboard::period($request->query('period'));

        return Inertia::render('games/index', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'period' => $period,
            'leaderboard' => Inertia::defer(fn (): array => $teamGameLeaderboard->handle($team, $period), 'leaderboard', true),
        ]);
    }

    public function store(Request $request, Workspace $workspace, Team $team, CreateGameRoom $createGameRoom): RedirectResponse
    {
        Gate::authorize('createGameRoom', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'game' => ['required', Rule::enum(GameKind::class)],
            'access' => ['required', Rule::enum(GameRoomAccess::class)],
        ]);

        $room = $createGameRoom->handle(
            $team,
            $request->user(),
            $validated['name'],
            GameKind::from($validated['game']),
            GameRoomAccess::from($validated['access']),
        );

        return to_route('games.show', $room);
    }
}
