<?php

namespace App\Support\Surveys;

use App\Actions\HealthCheck\HealthCheckQuestions;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyTemplate;
use App\Models\Team;
use App\Models\TeamSurveyQuestion;

class SurveyTemplateCatalogue
{
    public function __construct(private HealthCheckQuestions $healthCheckQuestions) {}

    /**
     * @return array<int, QuestionDefinition>
     */
    public function questions(?TeamSurveyTemplate $template, Team $team): array
    {
        return match ($template) {
            null => [],
            TeamSurveyTemplate::HealthCheck => $this->healthCheckQuestions->handle($team),
            TeamSurveyTemplate::TeamPulse => $this->teamPulse(),
        };
    }

    /**
     * @return array<int, array{
     *     key: ?string,
     *     name: string,
     *     description: string,
     *     questionCount: int
     * }>
     */
    public function options(Team $team): array
    {
        return [
            ['key' => null, 'name' => __('Blank'), 'description' => __('Start with no question.'), 'questionCount' => 0],
            [
                'key' => TeamSurveyTemplate::HealthCheck->value,
                'name' => __('Health check'),
                'description' => __('The team\'s statements, scored 1 to 5.'),
                'questionCount' => count($this->healthCheckQuestions->handle($team)),
            ],
            [
                'key' => TeamSurveyTemplate::TeamPulse->value,
                'name' => __('Team pulse'),
                'description' => __('Workload, recommendation, rituals and blockers.'),
                'questionCount' => count($this->teamPulse()),
            ],
        ];
    }

    /**
     * @return array<int, QuestionDefinition>
     */
    private function teamPulse(): array
    {
        return [
            new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Scale,
                label: __('How do you rate the workload of this sprint?'),
                matchKey: 'pulse_workload',
                isRequired: true,
                allowsComment: true,
                scaleMax: TeamSurveyQuestion::BuilderScaleMax,
                scaleMinLabel: __('Unbearable'),
                scaleMaxLabel: __('Very comfortable'),
            ),
            new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Nps,
                label: __('Would you recommend this team to a developer friend?'),
                matchKey: 'pulse_recommendation',
                isRequired: true,
                allowsComment: true,
            ),
            new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Single,
                label: __('Which ritual should we keep at all costs?'),
                matchKey: 'pulse_ritual',
                options: [__('Retrospective'), __('Daily'), __('Planning poker'), __('Sprint review')],
            ),
            new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Multiple,
                label: __('What slowed you down this sprint?'),
                matchKey: 'pulse_blockers',
                options: [
                    __('Too many meetings'),
                    __('Dependency on another team'),
                    __('Test environment'),
                    __('Unclear specifications'),
                    __('Something else'),
                ],
            ),
            new QuestionDefinition(
                kind: TeamSurveyQuestionKind::Text,
                label: __('A word for the team?'),
                matchKey: 'pulse_word',
            ),
        ];
    }
}
