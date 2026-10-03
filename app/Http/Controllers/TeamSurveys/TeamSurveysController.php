<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\BuildTeamSurveySnapshot;
use App\Actions\TeamSurveys\CreateTeamSurvey;
use App\Actions\TeamSurveys\NewTeamSurvey;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Events\TeamSurveys\TeamSurveyDeleted;
use App\Http\Controllers\Controller;
use App\Http\Requests\TeamSurveys\TeamSurveyStoreRequest;
use App\Http\Requests\TeamSurveys\TeamSurveyUpdateRequest;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class TeamSurveysController extends Controller
{
    public function store(TeamSurveyStoreRequest $request, Workspace $workspace, Team $team, CreateTeamSurvey $createTeamSurvey): RedirectResponse
    {
        $survey = $createTeamSurvey->handle($team, $request->user(), new NewTeamSurvey(
            title: $request->validated('title'),
            template: $request->enum('template', TeamSurveyTemplate::class),
            guestAccessEnabled: $request->boolean('guest_access_enabled'),
        ));

        return to_route('surveys.edit', $survey);
    }

    public function show(Request $request, TeamSurvey $teamSurvey, BuildTeamSurveySnapshot $buildTeamSurveySnapshot): Response|RedirectResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::viewable($teamSurvey, $respondent);

        if ($teamSurvey->status === TeamSurveyStatus::Draft) {
            return to_route('surveys.edit', $teamSurvey);
        }

        return Inertia::render('surveys/show', [
            'snapshot' => $buildTeamSurveySnapshot->handle($teamSurvey, $respondent),
        ]);
    }

    public function edit(Request $request, TeamSurvey $teamSurvey, BuildTeamSurveySnapshot $buildTeamSurveySnapshot): Response
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::notGuest($respondent);
        TeamSurveyGuard::editor($teamSurvey, $respondent);

        return Inertia::render('surveys/edit', [
            'snapshot' => $buildTeamSurveySnapshot->handle($teamSurvey, $respondent),
        ]);
    }

    public function update(TeamSurveyUpdateRequest $request, TeamSurvey $teamSurvey, BuildTeamSurveySnapshot $buildTeamSurveySnapshot): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $updated = DB::transaction(function () use ($request, $teamSurvey, $respondent): TeamSurvey {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);

            $locked->fill($request->validated());
            $locked->version++;
            $locked->save();

            TeamSurveyChanged::for($locked)->sendToOthers();

            return $locked;
        });

        return response()->json($buildTeamSurveySnapshot->handle($updated, $respondent));
    }

    public function destroy(Request $request, TeamSurvey $teamSurvey): HttpResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        DB::transaction(function () use ($teamSurvey, $respondent): void {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);

            $surveyId = $locked->id;

            $locked->delete();

            (new TeamSurveyDeleted($surveyId))->sendToOthers();
        });

        return response()->noContent();
    }
}
