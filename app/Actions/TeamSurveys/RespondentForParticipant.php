<?php

namespace App\Actions\TeamSurveys;

use App\Models\Participant;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;

class RespondentForParticipant
{
    public function handle(TeamSurvey $survey, Participant $participant): TeamSurveyRespondent
    {
        if ($participant->user_id === null) {
            return TeamSurveyRespondent::query()->firstOrCreate(
                ['team_survey_id' => $survey->id, 'participant_id' => $participant->id],
                ['guest_name' => $participant->guest_name],
            );
        }

        $respondent = TeamSurveyRespondent::query()->firstOrCreate([
            'team_survey_id' => $survey->id,
            'user_id' => $participant->user_id,
        ]);

        if ($respondent->participant_id === null) {
            $respondent->update(['participant_id' => $participant->id]);
        }

        return $respondent;
    }
}
