<?php

namespace App\Support\Surveys;

use App\Enums\HealthStatement;
use App\Enums\TeamSurveyQuestionKind;

class QuestionDefinition
{
    /**
     * @param  array<int, string>  $options
     */
    public function __construct(
        public TeamSurveyQuestionKind $kind,
        public string $label,
        public ?string $shortLabel = null,
        public ?string $description = null,
        public ?HealthStatement $builtin = null,
        public ?string $matchKey = null,
        public bool $isRequired = false,
        public bool $allowsComment = false,
        public ?int $scaleMax = null,
        public ?string $scaleMinLabel = null,
        public ?string $scaleMaxLabel = null,
        public array $options = [],
    ) {}
}
