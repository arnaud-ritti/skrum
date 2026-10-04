<?php

namespace App\Http\Controllers;

use App\Actions\Teams\ResolveTeamAddress;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class TeamAddressesController extends Controller
{
    public function show(Request $request, string $slug, ResolveTeamAddress $resolveTeamAddress): RedirectResponse
    {
        $team = $resolveTeamAddress->handle($request->user(), $slug);

        abort_if($team === null, 404);

        return to_route('teams.show', [$team->workspace, $team]);
    }
}
