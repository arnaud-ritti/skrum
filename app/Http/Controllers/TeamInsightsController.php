<?php

namespace App\Http\Controllers;

use App\Actions\Teams\BuildTeamMoodTrend;
use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamInsightsController extends Controller
{
    private const int RetrosShown = 50;

    /**
     * The mood and ROTI of a team: its trend, then the ROTI of each of its last completed retros,
     * dated like the trend by the day the retro was completed.
     *
     * ponytail: the newest retros with a vote only, page the list if a team outgrows RetrosShown.
     */
    public function show(Workspace $workspace, Team $team, BuildTeamMoodTrend $buildTeamMoodTrend): Response
    {
        Gate::authorize('view', $team);

        return Inertia::render('teams/insights', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'moodTrend' => Inertia::defer(fn (): array => $buildTeamMoodTrend->handle($team), 'trend', rescue: true),
            'retros' => $team->retros()
                ->where('phase', RetroPhase::Completed)
                ->whereNotNull('completed_at')
                ->whereHas('rotiVotes')
                ->withAvg('rotiVotes', 'score')
                ->latest('completed_at')
                ->orderByDesc('id')
                ->limit(self::RetrosShown)
                ->get()
                ->map(fn (Retro $retro): array => [
                    'id' => $retro->id,
                    'title' => $retro->title,
                    'url' => route('retros.show', $retro),
                    'roti' => round((float) $retro->roti_votes_avg_score, 1),
                    'closedOn' => $retro->completed_at->toDateString(),
                ])
                ->all(),
        ]);
    }
}
