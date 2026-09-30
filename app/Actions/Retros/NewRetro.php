<?php

namespace App\Actions\Retros;

use App\Enums\GameKind;

class NewRetro
{
    public function __construct(
        public string $title,
        public string $template,
        public bool $isAnonymous = false,
        public bool $healthCheckEnabled = false,
        public bool $icebreakerEnabled = false,
        public ?int $votesPerParticipant = null,
        public bool $aiSummaryEnabled = false,
        public ?GameKind $icebreakerGame = null,
    ) {}
}
