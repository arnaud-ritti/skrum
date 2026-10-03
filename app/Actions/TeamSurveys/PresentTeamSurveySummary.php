<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyStatus;
use App\Models\TeamSurvey;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PresentTeamSurveySummary
{
    /**
     * @template TQuery of HasMany<TeamSurvey, *>|Builder<TeamSurvey>
     *
     * @param  TQuery  $query
     * @return TQuery
     */
    public static function withCounts(HasMany|Builder $query): HasMany|Builder
    {
        return $query
            ->with('facilitator.user')
            ->withCount([
                'questions',
                'respondents as responses_count' => fn (Builder $respondents) => $respondents->whereHas('answers'),
            ]);
    }

    /**
     * @return array{
     *     id: string,
     *     title: string,
     *     status: string,
     *     template: ?string,
     *     questionCount: int,
     *     responseCount: int,
     *     updatedAt: ?string,
     *     closedAt: ?string,
     *     facilitatorName: ?string,
     *     canManage: bool,
     *     url: string
     * }
     */
    public function handle(TeamSurvey $survey, User $viewer, bool $viewerManagesWorkspace): array
    {
        return [
            'id' => $survey->id,
            'title' => $survey->title,
            'status' => $survey->status->value,
            'template' => $survey->template?->value,
            'questionCount' => (int) $survey->getAttribute('questions_count'),
            'responseCount' => (int) $survey->getAttribute('responses_count'),
            'updatedAt' => $survey->updated_at?->toIso8601String(),
            'closedAt' => $survey->closed_at?->toIso8601String(),
            'facilitatorName' => $survey->facilitator?->displayName(),
            'canManage' => $viewerManagesWorkspace || $survey->facilitator?->user_id === $viewer->id,
            'url' => $survey->status === TeamSurveyStatus::Draft
                ? route('surveys.edit', $survey, absolute: false)
                : route('surveys.results.show', $survey, absolute: false),
        ];
    }
}
