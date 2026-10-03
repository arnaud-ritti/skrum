<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\AnnounceSurveyResponses;
use App\Actions\TeamSurveys\BuildTeamSurveySnapshot;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TeamSurveySubmissionsController extends Controller
{
    public function __construct(
        private AnnounceSurveyResponses $announceSurveyResponses,
        private BuildTeamSurveySnapshot $buildTeamSurveySnapshot,
    ) {}

    public function store(Request $request, TeamSurvey $teamSurvey): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::open($teamSurvey);

        $locked = DB::transaction(function () use ($teamSurvey, $respondent): TeamSurvey {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::open($locked);

            $this->ensureComplete($locked, $respondent);

            $respondent->update(['completed_at' => now()]);

            $this->announceSurveyResponses->handle($locked);

            return $locked;
        });

        return response()->json($this->buildTeamSurveySnapshot->handle($locked, $respondent->fresh()));
    }

    public function destroy(Request $request, TeamSurvey $teamSurvey): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::open($teamSurvey);

        $locked = DB::transaction(function () use ($teamSurvey, $respondent): TeamSurvey {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::open($locked);

            $respondent->update(['completed_at' => null]);

            $this->announceSurveyResponses->handle($locked);

            return $locked;
        });

        return response()->json($this->buildTeamSurveySnapshot->handle($locked, $respondent->fresh()));
    }

    private function ensureComplete(TeamSurvey $survey, TeamSurveyRespondent $respondent): void
    {
        if (! $respondent->answers()->exists()) {
            throw ValidationException::withMessages(['survey' => __('Answer at least one question before finishing.')]);
        }

        $missing = $survey->questions()
            ->where('is_required', true)
            ->whereDoesntHave('answers', fn (Builder $answers) => $answers->where('team_survey_respondent_id', $respondent->id))
            ->pluck('id');

        if ($missing->isEmpty()) {
            return;
        }

        throw ValidationException::withMessages(
            $missing->mapWithKeys(fn (string $id): array => ["questions.{$id}" => __('An answer is required.')])->all(),
        );
    }
}
