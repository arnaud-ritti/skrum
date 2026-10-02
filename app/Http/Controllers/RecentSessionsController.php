<?php

namespace App\Http\Controllers;

use App\Actions\Search\ListRecentSessions;
use App\Support\CurrentTeamResolver;
use Illuminate\Http\JsonResponse;

class RecentSessionsController extends Controller
{
    public function index(CurrentTeamResolver $teams, ListRecentSessions $listRecentSessions): JsonResponse
    {
        return response()->json([
            'sessions' => $listRecentSessions->handle($teams->visibleTeams()),
        ]);
    }
}
