<?php

namespace App\Actions\Integrations;

use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\TrackerIssue;

class PokerImportBatch
{
    /**
     * @param  list<string>  $externalIds  in the order the client chose them
     * @param  array<string, TrackerIssue>  $issues  keyed by external id; an id the source did not return is absent
     */
    public function __construct(
        public TeamIntegration $integration,
        public array $externalIds,
        public array $issues,
    ) {}
}
