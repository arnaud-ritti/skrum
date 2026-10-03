<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Support\Integrations\Trackers\DoneMapping;
use App\Support\Integrations\Trackers\TrackerIssue;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Spec 6 §6.4, spec 8 §5.7 and plan 22 §6.5: title, description,
 * assignee, type, labels, source estimate and status follow the source;
 * the skrum estimate never changes; ended games are frozen. Used by the
 * manual refresh and by the automatic sync.
 */
class ApplyPokerTaskIssues
{
    /**
     * @param  Collection<int, PokerTask>  $tasks
     * @param  array<string, TrackerIssue>  $issues
     * @param  bool  $complete  every task's issue was asked for, so an absent one is gone
     * @return array{found: int, missing: int, changed: array<int, PokerTask>}
     */
    public function handle(PokerGame $game, Collection $tasks, array $issues, bool $complete): array
    {
        return DB::transaction(function () use ($game, $tasks, $issues, $complete): array {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->first();
            $result = ['found' => 0, 'missing' => 0, 'changed' => []];

            if ($locked === null || $locked->isEnded()) {
                return $result;
            }

            $query = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($tasks->pluck('id')->all());

            foreach ($query->lockForUpdate()->get() as $task) {
                $issue = $issues[(string) $task->external_id] ?? null;

                if ($issue === null) {
                    $result['missing']++;

                    if ($complete && $task->external_missing_at === null) {
                        $task->forceFill(['external_missing_at' => now()])->save();
                        $result['changed'][] = $task;
                    }

                    continue;
                }

                $result['found']++;
                $task->forceFill($this->fields($task, $issue));
                $changed = $task->isDirty();
                $task->forceFill(['external_refreshed_at' => now()])->save();

                if ($changed) {
                    $result['changed'][] = $task;
                }
            }

            return $result;
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function fields(PokerTask $task, TrackerIssue $issue): array
    {
        $provider = IntegrationProvider::from((string) $task->external_source);

        return [
            'title' => $issue->title,
            'description' => $issue->description,
            'external_key' => $issue->key,
            'external_url' => $issue->url,
            'external_assignee' => $issue->assignee,
            'external_type' => $issue->type,
            'external_labels' => $issue->labels === [] ? null : $issue->labels,
            'external_estimate' => $issue->estimate,
            'external_status_name' => $issue->status,
            'external_status_category' => $issue->issueStatus === null
                ? $task->external_status_category
                : DoneMapping::category($provider, $issue->issueStatus->kind),
            'external_updated_at' => $issue->issueStatus->updatedAt ?? $task->external_updated_at,
            'external_missing_at' => null,
        ];
    }
}
