<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyStatus;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Support\Surveys\SurveyTemplateCatalogue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateTeamSurvey
{
    public function __construct(
        private SurveyTemplateCatalogue $surveyTemplateCatalogue,
        private WriteSurveyQuestions $writeSurveyQuestions,
    ) {}

    /**
     * A survey attached to a retro has no minimum of answers, shows every
     * statement at once and keeps its results for the end, as the health
     * check of a retro always did.
     */
    public function handle(Team $team, ?User $creator, NewTeamSurvey $data): TeamSurvey
    {
        return DB::transaction(function () use ($team, $creator, $data): TeamSurvey {
            $isAttached = $data->retro !== null;

            $survey = $team->teamSurveys()->create([
                'retro_id' => $data->retro?->id,
                'title' => $data->title,
                'template' => $data->template,
                'status' => $data->open ? TeamSurveyStatus::Open : TeamSurveyStatus::Draft,
                'opened_at' => $data->open ? now() : null,
                'created_by_user_id' => $creator?->id,
                'guest_access_enabled' => $data->guestAccessEnabled,
                'guest_token' => Str::random(40),
                'results_threshold' => $isAttached ? 0 : TeamSurvey::StandaloneThreshold,
                'one_question_at_a_time' => ! $isAttached,
                'show_results_after_answer' => ! $isAttached,
            ]);

            if ($creator !== null) {
                $respondent = $survey->respondents()->create(['user_id' => $creator->id]);

                $survey->update(['facilitator_respondent_id' => $respondent->id]);
            }

            $this->writeSurveyQuestions->handle($survey, $this->surveyTemplateCatalogue->questions($data->template, $team));

            return $survey;
        });
    }
}
