<?php

namespace App\Actions\Surveys;

use App\Actions\Retros\PresentComment;
use App\Actions\Retros\SummarizeReactions;
use App\Enums\SurveyKind;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyOption;
use App\Models\SurveyTextAnswer;
use App\Support\Alphabetical;

class PresentSurvey
{
    public const Relations = [
        'options',
        'responses',
        'textAnswers',
        'reactions.participant.user',
        'comments.participant.user',
    ];

    public function __construct(
        private SummarizeReactions $summarizeReactions,
        private PresentComment $presentComment,
    ) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function many(Retro $retro, Participant $viewer): array
    {
        return $retro->surveys()
            ->with(self::Relations)
            ->get()
            ->map(fn (Survey $survey): array => $this->handle($survey, $retro, $viewer))
            ->values()
            ->all();
    }

    /**
     * Counts, voters, text answers, reactions and comments are only sent to
     * viewers who answered or once the survey is closed, so the discussion
     * cannot steer answers or reveal results early.
     *
     * @return array{
     *     id: string,
     *     kind: string,
     *     question: string,
     *     description: ?string,
     *     position: int,
     *     isClosed: bool,
     *     version: int,
     *     showVoters: bool,
     *     responseCount: int,
     *     myOptionIds: array<int, string>,
     *     myText: ?string,
     *     resultsVisible: bool,
     *     options: array<int, array{id: string, label: string, position: int, count: ?int, voters: ?array<int, string>}>,
     *     textAnswers: ?array<int, array{id: string, text: string, authorId: ?string, isMine: bool}>,
     *     reactions: array<int, array{emoji: string, count: int, mine: bool, names: array<int, string>}>,
     *     commentCount: int,
     *     comments: array<int, array<string, mixed>>
     * }
     */
    public function handle(Survey $survey, Retro $retro, Participant $viewer): array
    {
        $survey->loadMissing(self::Relations);

        $myResponseOptionIds = $survey->responses->where('participant_id', $viewer->id)->pluck('survey_option_id');
        $myOptionIds = $survey->options->pluck('id')->intersect($myResponseOptionIds)->values()->all();
        $myText = $survey->textAnswers->firstWhere('participant_id', $viewer->id)?->content;
        $resultsVisible = $survey->is_closed || $myOptionIds !== [] || $myText !== null;
        $showsNames = $survey->show_voters && ! $retro->is_anonymous;

        return [
            'id' => $survey->id,
            'kind' => $survey->kind->value,
            'question' => $survey->question,
            'description' => $survey->description,
            'position' => $survey->position,
            'isClosed' => $survey->is_closed,
            'version' => $survey->version,
            'showVoters' => $showsNames,
            'responseCount' => $this->responseCount($survey),
            'myOptionIds' => $myOptionIds,
            'myText' => $myText,
            'resultsVisible' => $resultsVisible,
            'options' => $survey->options->map(fn (SurveyOption $option): array => [
                'id' => $option->id,
                'label' => $option->label,
                'position' => $option->position,
                'count' => $resultsVisible ? $survey->responses->where('survey_option_id', $option->id)->count() : null,
                'voters' => $resultsVisible && $showsNames
                    ? $survey->responses->where('survey_option_id', $option->id)->pluck('participant_id')->values()->all()
                    : null,
            ])->values()->all(),
            'textAnswers' => $resultsVisible && $survey->kind === SurveyKind::Text
                ? $this->textAnswers($survey, $viewer, $showsNames)
                : null,
            'reactions' => $resultsVisible
                ? $this->summarizeReactions->handle($survey->reactions, $retro, $viewer, $showsNames)
                : [],
            'commentCount' => $survey->comments->reject(fn (SurveyComment $comment): bool => $comment->isDeleted())->count(),
            'comments' => $resultsVisible ? $this->presentComment->threads($survey->comments, $retro, $viewer) : [],
        ];
    }

    private function responseCount(Survey $survey): int
    {
        if ($survey->kind === SurveyKind::Text) {
            return $survey->textAnswers->count();
        }

        return $survey->responses->pluck('participant_id')->unique()->count();
    }

    /**
     * Ordered by text so the order reveals neither when nor by whom an
     * answer was written.
     *
     * @return array<int, array{id: string, text: string, authorId: ?string, isMine: bool}>
     */
    private function textAnswers(Survey $survey, Participant $viewer, bool $showsNames): array
    {
        return Alphabetical::sort($survey->textAnswers->sortBy('id'), fn (SurveyTextAnswer $answer): string => $answer->content)
            ->map(fn (SurveyTextAnswer $answer): array => [
                'id' => $answer->id,
                'text' => $answer->content,
                'authorId' => $showsNames ? $answer->participant_id : null,
                'isMine' => $answer->participant_id === $viewer->id,
            ])
            ->values()
            ->all();
    }
}
