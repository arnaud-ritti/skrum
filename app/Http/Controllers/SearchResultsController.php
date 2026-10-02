<?php

namespace App\Http\Controllers;

use App\Actions\Search\SearchWorkspaceContent;
use App\Http\Requests\SearchRequest;
use App\Support\CurrentTeamResolver;
use Illuminate\Http\JsonResponse;

class SearchResultsController extends Controller
{
    public function index(SearchRequest $request, CurrentTeamResolver $teams, SearchWorkspaceContent $search): JsonResponse
    {
        return response()->json([
            'results' => $search->handle($teams->visibleTeams(), $request->validated('q'), $request->user()),
        ]);
    }
}
