<?php

namespace App\Actions\Integrations;

use App\Exceptions\Integrations\IntegrationException;
use App\Models\Team;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Validation\ValidationException;

/**
 * Spec plan 22 §6.4: the tickets are read from the source before the game
 * exists, so that a failing tracker leaves nothing behind. Only the ids
 * the client sends are trusted, as ids.
 */
class FetchPokerImport
{
    public function __construct(
        private ResolvePokerTracker $resolvePokerTracker,
        private Trackers $trackers,
    ) {}

    /**
     * An unknown or disabled source stays a 404; a missing or broken
     * connection is a message on the import, like a failing tracker.
     *
     * @param  list<string>  $externalIds
     */
    public function handle(Team $team, string $source, array $externalIds): PokerImportBatch
    {
        $externalIds = array_values(array_unique($externalIds));

        try {
            $integration = $this->resolvePokerTracker->handle($team, $source);
            $issues = $this->trackers->for($integration->provider)->issues($integration, $externalIds);
        } catch (IntegrationException $exception) {
            throw ValidationException::withMessages(['import_ids' => $exception->userMessage()]);
        }

        return new PokerImportBatch($integration, $externalIds, $issues);
    }
}
