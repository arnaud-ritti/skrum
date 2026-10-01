<?php

namespace App\Support\Integrations\Inbound;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use Illuminate\Support\Collection;

/**
 * What a verified delivery says, and nothing more (spec 8 §5.3): its key,
 * type, the connections it concerns and the issues to re-read.
 */
class InboundEvent
{
    /**
     * @param  Collection<int, TeamIntegration>  $integrations
     * @param  array<int, string>  $externalIds
     * @param  array<int, string>  $removedRepositoryIds
     * @param  'deleted'|'suspend'|null  $installationRemoved
     */
    public function __construct(
        public IntegrationProvider $provider,
        public string $key,
        public string $type,
        public Collection $integrations,
        public array $externalIds = [],
        public array $removedRepositoryIds = [],
        public ?string $installationRemoved = null,
        public ?string $installationId = null,
    ) {}
}
