<?php

namespace App\Http\Controllers;

use App\Actions\Retros\CreateRetro;
use App\Enums\RetroTemplate;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeamRetrosController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, CreateRetro $createRetro): RedirectResponse
    {
        Gate::authorize('createRetro', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'template' => ['required', Rule::enum(RetroTemplate::class)],
        ]);

        $retro = $createRetro->handle($team, $request->user(), $validated['title'], RetroTemplate::from($validated['template']));

        return to_route('retros.show', $retro);
    }
}
