<?php

namespace App\Actions\Retros;

use App\Enums\ColumnColor;
use App\Enums\GameKind;

class NewRetro
{
    /**
     * @param  ?array<int, array{title: string, description: ?string, color: ColumnColor}>  $columns
     */
    public function __construct(
        public string $title,
        public string $template,
        public bool $isAnonymous = false,
        public bool $healthCheckEnabled = false,
        public bool $icebreakerEnabled = false,
        public ?int $votesPerParticipant = null,
        public bool $aiSummaryEnabled = false,
        public ?GameKind $icebreakerGame = null,
        public bool $guestAccessEnabled = false,
        public ?array $columns = null,
        public ?int $maxVotesPerCard = null,
    ) {}
}
