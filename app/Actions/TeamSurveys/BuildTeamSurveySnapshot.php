<?php

namespace App\Actions\TeamSurveys;

use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;

class BuildTeamSurveySnapshot
{
    /**
     * @return array<string, mixed>
     */
    public function handle(TeamSurvey $survey, TeamSurveyRespondent $viewer): array
    {
        $survey->loadMissing(['team.workspace', 'retro', 'facilitator.user']);
        $viewer->loadMissing('user');

        $isGuest = $viewer->isGuest();
        $isEditor = $survey->isEditor($viewer);

        return [
            'survey' => [
                'id' => $survey->id,
                'title' => $survey->title,
                'description' => $survey->description,
                'status' => $survey->status->value,
                'template' => $survey->template?->value,
                'hasLockedQuestions' => $survey->hasLockedQuestions(),
                'teamId' => $survey->team_id,
                'teamName' => $isGuest ? null : $survey->team->name,
                'retroId' => $survey->retro_id,
                'facilitatorName' => $survey->facilitator?->displayName(),
                'guestAccessEnabled' => $survey->guest_access_enabled,
                'guestUrl' => $isGuest ? null : route('surveys.join.show', $survey->guest_token),
                'oneQuestionAtATime' => $survey->one_question_at_a_time,
                'showResultsAfterAnswer' => $survey->show_results_after_answer,
                'resultsThreshold' => $survey->results_threshold,
                'version' => $survey->version,
                'openedAt' => $survey->opened_at?->toIso8601String(),
                'closedAt' => $survey->closed_at?->toIso8601String(),
            ],
            'me' => [
                'id' => $viewer->id,
                'name' => $viewer->displayName(),
                'avatarUrl' => $viewer->avatarUrl(),
                'isGuest' => $isGuest,
                'isEditor' => $isEditor,
                'hasSubmitted' => $viewer->hasSubmitted(),
                'canSeeResults' => $survey->resultsVisibleTo($viewer),
            ],
            'links' => [
                'team' => $isGuest ? null : route('teams.show', [$survey->team->workspace, $survey->team], absolute: false),
                'show' => route('surveys.show', $survey, absolute: false),
                'results' => route('surveys.results.show', $survey, absolute: false),
                'edit' => $isEditor && ! $isGuest ? route('surveys.edit', $survey, absolute: false) : null,
            ],
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }
}
