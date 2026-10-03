<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyTemplate;
use App\Models\Retro;

class NewTeamSurvey
{
    public function __construct(
        public string $title,
        public ?TeamSurveyTemplate $template = null,
        public bool $guestAccessEnabled = false,
        public ?Retro $retro = null,
        public bool $open = false,
    ) {}
}
