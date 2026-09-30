<?php

namespace App\Actions\Integrations;

use App\Actions\Poker\PokerGuard;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Poker\PokerGameChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Trackers\TrackerIssue;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Spec 6 §6.4: title, description, assignee and source estimate follow the
 * source on demand; the skrum estimate never changes. Issues the source no
 * longer returns keep their data and are only counted.
 */
class RefreshPokerTasks
{
    public function __construct(private Trackers $trackers) {}

    /**
     * @return array{refreshed: int, missing: int}
     */
    public function handle(PokerGame $game, PokerPlayer $player): array
    {
        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $refreshed = 0;
        $missing = 0;
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

            [$updated, $notFound] = $this->apply($game, $onSite, $issues);
            $refreshed += $updated;
            $missing += $notFound;
        }

        if (! $attempted && $problem !== null) {
            throw $problem;
        }

        if ($refreshed > 0) {
            (new PokerGameChanged($game->id))->sendToOthers();
        }

        return ['refreshed' => $refreshed, 'missing' => $missing];
    }

    /**
     * @param  Collection<int, PokerTask>  $tasks
     * @param  array<string, TrackerIssue>  $issues
     * @return array{0: int, 1: int}
     */
    private function apply(PokerGame $game, Collection $tasks, array $issues): array
    {
        return DB::transaction(function () use ($game, $tasks, $issues): array {
            PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            $updated = 0;
            $notFound = 0;

            foreach (PokerTask::query()->whereKey($tasks->pluck('id')->all())->get() as $task) {
                $issue = $issues[(string) $task->external_id] ?? null;

                if ($issue === null) {
                    $notFound++;

                    continue;
                }

                $task->forceFill([
                    'title' => $issue->title,
                    'description' => $issue->description,
                    'external_key' => $issue->key,
                    'external_url' => $issue->url,
                    'external_assignee' => $issue->assignee,
                    'external_estimate' => $issue->estimate,
                    'external_refreshed_at' => now(),
                ])->save();

                $updated++;
            }

            return [$updated, $notFound];
        });
    }

    private function connectionProblem(IntegrationProvider $provider, ?IntegrationStatus $status, ?string $error): IntegrationException
    {
        return $status === IntegrationStatus::ReconnectRequired
            ? new ReconnectRequired($provider, $error)
            : new NotConnected($provider);
    }
}
