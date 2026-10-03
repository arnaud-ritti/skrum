<?php

namespace App\Actions\TeamSurveys;

use App\Models\TeamSurvey;
use App\Support\Surveys\QuestionDefinition;

class WriteSurveyQuestions
{
    /**
     * Runs inside the caller's transaction.
     *
     * @param  array<int, QuestionDefinition>  $definitions
     */
    public function handle(TeamSurvey $survey, array $definitions): void
    {
        $survey->questions()->delete();

        foreach (array_values($definitions) as $position => $definition) {
            $question = $survey->questions()->create([
                'kind' => $definition->kind,
                'label' => $definition->label,
                'short_label' => $definition->shortLabel,
                'description' => $definition->description,
                'builtin' => $definition->builtin,
                'match_key' => $definition->matchKey,
                'position' => $position,
                'is_required' => $definition->isRequired,
                'allows_comment' => $definition->allowsComment,
                'scale_max' => $definition->scaleMax,
                'scale_min_label' => $definition->scaleMinLabel,
                'scale_max_label' => $definition->scaleMaxLabel,
            ]);

            foreach (array_values($definition->options) as $optionPosition => $label) {
                $question->options()->create(['label' => $label, 'position' => $optionPosition]);
            }
        }
    }
}
