<?php

namespace App\Actions\HealthCheck;

use App\Actions\TeamSurveys\CreateTeamSurvey;
use App\Actions\TeamSurveys\NewTeamSurvey;
use App\Actions\TeamSurveys\RespondentForParticipant;
use App\Actions\TeamSurveys\WriteSurveyQuestions;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Retro;
use App\Models\TeamSurvey;
use Illuminate\Validation\ValidationException;

class AttachHealthCheck
{
    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private CreateTeamSurvey $createTeamSurvey,
        private RespondentForParticipant $respondentForParticipant,
        private WriteSurveyQuestions $writeSurveyQuestions,
        private HealthCheckQuestions $healthCheckQuestions,
    ) {}

    /**
     * Runs inside the caller's transaction, on a retro row locked for update.
     */
    public function handle(Retro $locked): TeamSurvey
    {
        if ($this->healthCheckSurvey->forRetro($locked) !== null) {
            throw ValidationException::withMessages(['health_check' => __('This retro already has a health check.')]);
        }

        $hidden = $this->healthCheckSurvey->hidden($locked);

        if ($hidden !== null) {
            return $this->bringBack($hidden, $locked);
        }

        $facilitator = $locked->facilitator;

        $survey = $this->createTeamSurvey->handle($locked->team, $facilitator?->user, new NewTeamSurvey(
            title: $locked->title,
            template: TeamSurveyTemplate::HealthCheck,
            retro: $locked,
            open: true,
        ));

        if ($facilitator !== null) {
            $survey->update(['facilitator_respondent_id' => $this->respondentForParticipant->handle($survey, $facilitator)->id]);
        }

        return $survey;
    }

    /**
     * The statements follow the team again, on the scale of five, only when
     * nobody had answered: answers refer to the questions they were given to.
     */
    private function bringBack(TeamSurvey $hidden, Retro $locked): TeamSurvey
    {
        if (! $hidden->hasAnswers()) {
            $this->writeSurveyQuestions->handle($hidden, $this->healthCheckQuestions->handle($locked->team));
        }

        $hidden->update([
            'status' => TeamSurveyStatus::Open,
            'opened_at' => $hidden->opened_at ?? now(),
            'closed_at' => null,
            'version' => $hidden->version + 1,
        ]);

        return $hidden;
    }
}
