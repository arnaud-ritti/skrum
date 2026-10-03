<?php

namespace App\Actions\HealthCheck;

use App\Enums\TeamSurveyQuestionKind;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Support\Surveys\HealthScale;
use App\Support\Surveys\QuestionDefinition;

class HealthCheckQuestions
{
    public function __construct(private TeamHealthStatements $teamHealthStatements) {}

    /**
     * One required question per active statement, on the health scale. The
     * ends "Strongly disagree" / "Strongly agree" are not stored: they are
     * translated for each reader.
     *
     * @return array<int, QuestionDefinition>
     */
    public function handle(Team $team): array
    {
        return $this->teamHealthStatements->active($team)
            ->map(fn (TeamHealthStatement $statement): QuestionDefinition => new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Scale,
                label: $statement->builtin?->text() ?? (string) $statement->text,
                shortLabel: $statement->builtin?->label() ?? $statement->label,
                builtin: $statement->builtin,
                matchKey: $statement->key(),
                isRequired: true,
                scaleMax: HealthScale::Max,
            ))
            ->values()
            ->all();
    }
}
