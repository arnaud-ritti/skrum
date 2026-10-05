<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use App\Support\Sessions\JoinCodes;

class BuildTeamSurveySnapshot
{
    public function __construct(
        private PresentSurveyQuestion $presentSurveyQuestion,
        private BuildSurveyResults $buildSurveyResults,
        private CompareSurveys $compareSurveys,
        private JoinCodes $joinCodes,
    ) {}

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
                'joinCode' => $isGuest ? null : $this->joinCodes->for($survey),
                'oneQuestionAtATime' => $survey->one_question_at_a_time,
                'showResultsAfterAnswer' => $survey->show_results_after_answer,
                'resultsThreshold' => $survey->results_threshold,
                'version' => $survey->version,
                'openedAt' => $survey->opened_at?->toIso8601String(),
                'closedAt' => $survey->closed_at?->toIso8601String(),
                'savedAt' => $survey->updated_at?->toIso8601String(),
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
            'questions' => $this->questions($survey, $viewer),
            'progress' => $survey->progress(),
            'results' => $this->buildSurveyResults->handle($survey, $viewer),
            'comparable' => $this->comparable($survey, $viewer),
            'links' => [
                'team' => $isGuest ? null : route('teams.show', [$survey->team->workspace, $survey->team], absolute: false),
                'show' => route('surveys.show', $survey, absolute: false),
                'results' => route('surveys.results.show', $survey, absolute: false),
                'edit' => $isEditor && ! $isGuest ? route('surveys.edit', $survey, absolute: false) : null,
                'healthCheck' => $survey->hasLockedQuestions() && ! $isGuest
                    ? route('teams.healthCheck.show', [$survey->team->workspace, $survey->team], absolute: false)
                    : null,
            ],
            'viewerIsObserver' => $viewer->user?->isObserverOf($survey->team) ?? false,
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function questions(TeamSurvey $survey, TeamSurveyRespondent $viewer): array
    {
        $questions = $survey->questions()->with('options')->get();
        $questions->each->setRelation('survey', $survey);

        $myAnswers = TeamSurveyAnswer::query()
            ->where('team_survey_respondent_id', $viewer->id)
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->with('options')
            ->get()
            ->keyBy('team_survey_question_id');

        return $questions
            ->map(fn (TeamSurveyQuestion $question): array => $this->presentSurveyQuestion->handle($question, $myAnswers->get($question->id)))
            ->values()
            ->all();
    }

    /**
     * @return array{defaultId: ?string, surveys: array<int, array{id: string, title: string, closedAt: ?string}>}|null
     */
    private function comparable(TeamSurvey $survey, TeamSurveyRespondent $viewer): ?array
    {
        if ($viewer->isGuest()) {
            return null;
        }

        if (! $survey->resultsVisibleTo($viewer)) {
            return null;
        }

        $default = $this->compareSurveys->defaultFor($survey);
        $surveys = TeamSurvey::query()
            ->where('team_id', $survey->team_id)
            ->where('status', TeamSurveyStatus::Closed)
            ->whereKeyNot($survey->id)
            ->latest('closed_at')
            ->orderByDesc('id')
            ->limit(20)
            ->get(['id', 'title', 'closed_at']);

        if ($default !== null && $surveys->doesntContain('id', $default->id)) {
            $surveys->push($default);
        }

        return [
            'defaultId' => $default?->id,
            'surveys' => $surveys
                ->map(fn (TeamSurvey $other): array => [
                    'id' => $other->id,
                    'title' => $other->title,
                    'closedAt' => $other->closed_at?->toIso8601String(),
                ])
                ->all(),
        ];
    }
}
