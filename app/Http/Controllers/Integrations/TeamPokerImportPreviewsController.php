<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PreviewPokerImport;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Integrations\TrackerBrowseLimit;
use App\Support\Integrations\Trackers\TrackerIssue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeamPokerImportPreviewsController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, string $source, ResolvePokerTracker $resolvePokerTracker, PreviewPokerImport $previewPokerImport): JsonResponse
    {
        Gate::authorize('createPokerGame', $team);

        $validated = $request->validate([
            'mode' => ['required', Rule::in([PreviewPokerImport::ModeIteration, PreviewPokerImport::ModeQuery])],
            'iteration_id' => [Rule::requiredIf(fn (): bool => $request->input('mode') === PreviewPokerImport::ModeIteration && ! $request->boolean('browse')), 'nullable', 'string', 'max:100'],
            'browse' => ['sometimes', 'boolean'],
            'project_id' => ['nullable', 'string', 'max:100'],
            'search' => ['nullable', 'string', 'max:1000'],
            'status_id' => ['nullable', 'string', 'max:100'],
            'cursor' => ['nullable', 'string', 'max:500'],
            'query' => [Rule::requiredIf(fn (): bool => $request->input('mode') === PreviewPokerImport::ModeQuery && ! $request->boolean('browse')), 'nullable', 'string', 'max:1000'],
            'container' => ['nullable', 'string', 'max:100'],
        ]);

        $integration = $resolvePokerTracker->handle($team, $source);

        TrackerBrowseLimit::hit($request->user()->id);

        $list = $previewPokerImport->fetch(
            $integration,
            $validated['mode'],
            $validated['iteration_id'] ?? null,
            $validated['query'] ?? null,
            $validated['container'] ?? null,
            $validated['search'] ?? null,
            $validated['status_id'] ?? null,
            $validated['cursor'] ?? null,
            $validated['browse'] ?? false,
            $validated['project_id'] ?? null,
        );

        return response()->json([
            'issues' => array_map(fn (TrackerIssue $issue): array => $issue->preview(false), $list->issues),
            'truncated' => $list->truncated,
            ...($list->statuses !== null ? ['nextCursor' => $list->nextCursor, 'statuses' => $list->statuses] : []),
        ]);
    }
}
