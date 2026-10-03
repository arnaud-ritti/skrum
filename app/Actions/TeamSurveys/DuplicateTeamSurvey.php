<?php

namespace App\Actions\TeamSurveys;

use App\Models\TeamSurvey;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use App\Models\User;
use App\Support\Surveys\QuestionDefinition;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DuplicateTeamSurvey
{
    public function __construct(
        private CreateTeamSurvey $createTeamSurvey,
        private WriteSurveyQuestions $writeSurveyQuestions,
    ) {}

    /**
     * The copy is always a survey of its own, even when the source was
     * attached to a retro. A locked template takes the team's statements
     * of today rather than the ones the source froze.
     */
    public function handle(TeamSurvey $source, User $creator, ?string $title = null): TeamSurvey
    {
        return DB::transaction(function () use ($source, $creator, $title): TeamSurvey {
            $copy = $this->createTeamSurvey->handle($source->team, $creator, new NewTeamSurvey(
                title: $title ?? Str::limit(__('Copy of :name', ['name' => $source->title]), 120, ''),
                template: $source->template,
                guestAccessEnabled: $source->guest_access_enabled,
            ));

            $copy->update([
                'description' => $source->description,
                'one_question_at_a_time' => $source->retro_id === null ? $source->one_question_at_a_time : true,
                'show_results_after_answer' => $source->retro_id === null ? $source->show_results_after_answer : true,
                'previous_survey_id' => $source->id,
            ]);

            if (! $source->hasLockedQuestions()) {
                $this->writeSurveyQuestions->handle($copy, $this->definitions($source));
            }

            return $copy;
        });
    }

    /**
     * @return array<int, QuestionDefinition>
     */
    private function definitions(TeamSurvey $source): array
    {
        return $source->questions()->with('options')->get()
            ->map(fn (TeamSurveyQuestion $question): QuestionDefinition => new QuestionDefinition(
                kind: $question->kind,
                label: $question->label,
                shortLabel: $question->short_label,
                description: $question->description,
                builtin: $question->builtin,
                matchKey: $question->match_key,
                isRequired: $question->is_required,
                allowsComment: $question->allows_comment,
                scaleMax: $question->scale_max,
                scaleMinLabel: $question->scale_min_label,
                scaleMaxLabel: $question->scale_max_label,
                options: $question->options->map(fn (TeamSurveyOption $option): string => $option->label)->all(),
            ))
            ->all();
    }
}
