<?php

namespace App\Actions\Integrations;

use App\Actions\Poker\AddPokerTask;
use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\TrackerIssue;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Spec 6 §6.3. Issues are always fetched again from the source: nothing a
 * client sends about an issue is trusted, only its id.
 */
class ImportPokerTasks
{
    public function __construct(
        private Trackers $trackers,
        private PreviewPokerImport $previewPokerImport,
    ) {}

    /**
     * @param  array<int, string>  $externalIds
     * @return array{imported: int, skipped: int}
     */
    public function handle(PokerGame $game, PokerPlayer $player, TeamIntegration $integration, array $externalIds): array
    {
        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $externalIds = array_values(array_unique($externalIds));
        $issues = $this->trackers->for($integration->provider)->issues($integration, $externalIds);

        return $this->store($game, $player, $integration, $externalIds, $issues);
    }

    /**
     * @return array{imported: int, skipped: int, truncated: bool}
     */
    public function fromSource(PokerGame $game, PokerPlayer $player, TeamIntegration $integration, string $mode, ?string $iterationId, ?string $query): array
    {
        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $list = $this->previewPokerImport->fetch($integration, $mode, $iterationId, $query);
        $issues = [];

        foreach ($list->issues as $issue) {
            $issues[$issue->externalId] = $issue;
        }

        return [
            ...$this->store($game, $player, $integration, array_keys($issues), $issues),
            'truncated' => $list->truncated,
        ];
    }

    /**
     * @param  array<int, string>  $externalIds
     * @param  array<string, TrackerIssue>  $issues
     * @return array{imported: int, skipped: int}
     */
    private function store(PokerGame $game, PokerPlayer $player, TeamIntegration $integration, array $externalIds, array $issues): array
    {
        return DB::transaction(function () use ($game, $player, $integration, $externalIds, $issues): array {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::canEditTasks($player);

            $source = $integration->provider->value;
            $existing = $locked->tasks()
                ->where('external_source', $source)
                ->whereIn('external_id', $externalIds)
                ->pluck('external_id')
                ->flip();

            $new = array_values(array_filter(
                $externalIds,
                fn (string $id): bool => isset($issues[$id]) && ! $existing->has($id),
            ));

            if ($locked->tasks()->count() + count($new) > AddPokerTask::MaxTasks) {
                throw ValidationException::withMessages(['external_ids' => __('This game can hold 200 tasks at most.')]);
            }

            $position = (int) $locked->tasks()->max('position');

            foreach ($new as $id) {
                $issue = $issues[$id];
                $task = new PokerTask([
                    'title' => $issue->title,
                    'description' => $issue->description,
                    'position' => ++$position,
                ]);

                $task->forceFill([
                    'poker_game_id' => $locked->id,
                    'external_source' => $source,
                    'external_id' => $issue->externalId,
                    'external_url' => $issue->url,
                    'external_site' => $integration->site(),
                    'external_key' => $issue->key,
                    'external_assignee' => $issue->assignee,
                    'external_estimate' => $issue->estimate,
                    'external_refreshed_at' => now(),
                ])->save();
            }

            if ($new !== []) {
                (new PokerGameChanged($locked->id))->sendToOthers();
            }

            return ['imported' => count($new), 'skipped' => count($externalIds) - count($new)];
        });
    }
}
