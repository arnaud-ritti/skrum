<?php

namespace App\Actions\Integrations;

use App\Actions\Poker\PokerGuard;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Poker\PokerGameChanged;
use App\Exceptions\Integrations\IntegrationException;
use App\Exceptions\Integrations\NotConnected;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Support\Integrations\Trackers\Trackers;

/**
 * Spec 6 §6.4: title, description, assignee and source estimate follow the
 * source on demand; the skrum estimate never changes. Issues the source no
 * longer returns keep their data and show "Not found in :source".
 */
class RefreshPokerTasks
{
    public function __construct(
        private Trackers $trackers,
        private ApplyPokerTaskIssues $applyPokerTaskIssues,
    ) {}

    /**
     * @return array{refreshed: int, missing: int}
     */
    public function handle(PokerGame $game, PokerPlayer $player): array
    {
        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $refreshed = 0;
        $missing = 0;
        $changedTasks = 0;
        $attempted = false;
        $problem = null;

        foreach ($game->tasks()->whereNotNull('external_source')->get()->groupBy('external_source') as $source => $tasks) {
            $provider = IntegrationProvider::tryFrom((string) $source);

            if ($provider === null || ! $provider->isTracker() || ! $provider->isEnabled()) {
                continue;
            }

            $integration = $game->team->integration($provider);

            if ($integration === null || ! $integration->isActive()) {
                $problem ??= $this->connectionProblem($provider, $integration?->status, $integration?->last_error);

                continue;
            }

            $onSite = $tasks->where('external_site', $integration->site());

            if ($onSite->isEmpty()) {
                continue;
            }

            $attempted = true;
            $issues = $this->trackers->for($provider)->issues($integration, $onSite->pluck('external_id')->filter()->values()->all());

            $applied = $this->applyPokerTaskIssues->handle($game, $onSite, $issues, complete: true);
            $refreshed += $applied['found'];
            $missing += $applied['missing'];
            $changedTasks += count($applied['changed']);
        }

        throw_if(! $attempted && $problem !== null, $problem);

        if ($refreshed > 0 || $changedTasks > 0) {
            new PokerGameChanged($game->id)->sendToOthers();
        }

        return ['refreshed' => $refreshed, 'missing' => $missing];
    }

    private function connectionProblem(IntegrationProvider $provider, ?IntegrationStatus $status, ?string $error): IntegrationException
    {
        return $status === IntegrationStatus::ReconnectRequired
            ? new ReconnectRequired($provider, $error)
            : new NotConnected($provider);
    }
}
