<?php

namespace App\Actions\Poker;

use App\Actions\Integrations\PokerTaskSync;
use App\Models\PokerTask;
use App\Support\Poker\AcceptanceCriteriaSection;
use Illuminate\Support\Facades\Cache;

/**
 * @phpstan-type TaskExternal array{
 *     source: string,
 *     key: string,
 *     url: string,
 *     type: ?string,
 *     labels: list<string>,
 *     assignee?: ?string,
 *     sourceEstimate?: ?string,
 *     refreshedAt?: ?string,
 *     syncState?: ?string,
 *     syncError?: ?string,
 *     unsupportedReason?: ?string,
 *     status?: ?string,
 *     statusCategory?: ?string,
 *     missing?: bool,
 *     estimateConflict?: array{sourceEstimate: string, matchingCard: ?string}|null,
 *     syncMode?: string,
 *     isManaged: true
 * }
 * @phpstan-type Task array{
 *     id: string,
 *     title: string,
 *     description: ?string,
 *     descriptionHtml: string,
 *     acceptanceCriteriaHtml: string,
 *     position: int,
 *     estimate: ?string,
 *     estimatedAt: ?string,
 *     roundsCount: int,
 *     votesCount: int,
 *     external: ?TaskExternal
 * }
 */
class PresentPokerTask
{
    public function __construct(private RenderTaskMarkdown $renderTaskMarkdown) {}

    /**
     * Without a PokerTaskSync (broadcasts, guests) an imported task only
     * shows its source, key, link, type and labels: assignee names and sync
     * errors stay with the team (spec 6 §6.6, plan 22 §6.5). The criteria
     * section of the description is rendered apart (rules AC-1 to AC-6); the
     * raw description stays whole. `votesCount` is the number of votes of
     * the task's last round, never their values; a task created in this
     * request has no round yet and costs no query.
     *
     * @return Task
     */
    public function handle(PokerTask $task, ?PokerTaskSync $sync = null): array
    {
        $roundsCount = $task->getAttribute('rounds_count');
        $parts = AcceptanceCriteriaSection::split($task->description);

        return [
            'id' => $task->id,
            'title' => $task->title,
            'description' => $task->description,
            'descriptionHtml' => $this->html('poker-task-description', $task, $parts['description']),
            'acceptanceCriteriaHtml' => $this->html('poker-task-criteria', $task, $parts['criteria']),
            'position' => $task->position,
            'estimate' => $task->estimate,
            'estimatedAt' => $task->estimated_at?->toIso8601String(),
            'roundsCount' => $roundsCount === null ? $task->rounds()->count() : (int) $roundsCount,
            'votesCount' => $this->votesCount($task),
            'external' => $this->external($task, $sync),
        ];
    }

    private function votesCount(PokerTask $task): int
    {
        if ($task->wasRecentlyCreated && ! $task->relationLoaded('latestRound')) {
            return 0;
        }

        $latestRound = $task->latestRound;

        if ($latestRound === null) {
            return 0;
        }

        if ($latestRound->relationLoaded('votes')) {
            return $latestRound->votes->count();
        }

        $votesCount = $latestRound->getAttribute('votes_count');

        return $votesCount === null ? $latestRound->votes()->count() : (int) $votesCount;
    }

    /**
     * @return ?TaskExternal
     */
    private function external(PokerTask $task, ?PokerTaskSync $sync): ?array
    {
        if ($task->external_source === null || $task->external_key === null || $task->external_url === null) {
            return null;
        }

        $base = [
            'source' => $task->external_source,
            'key' => $task->external_key,
            'url' => $task->external_url,
            'type' => $task->external_type,
            'labels' => array_values($task->external_labels ?? []),
        ];

        if ($sync === null) {
            return [...$base, 'isManaged' => true];
        }

        $state = $sync->state($task);

        return [
            ...$base,
            'assignee' => $task->external_assignee,
            'sourceEstimate' => $task->external_estimate,
            'refreshedAt' => $task->external_refreshed_at?->toIso8601String(),
            'syncState' => $state,
            'syncError' => $state === PokerTaskSync::Failed ? $task->sync_error : null,
            'unsupportedReason' => $state === PokerTaskSync::Unsupported ? $sync->unsupportedReason($task) : null,
            'status' => $task->external_status_name,
            'statusCategory' => $task->external_status_category?->value,
            'missing' => $task->external_missing_at !== null,
            'estimateConflict' => $sync->estimateConflict($task),
            'syncMode' => $sync->syncMode($task),
            'isManaged' => true,
        ];
    }

    /**
     * Keyed by the hash of the text rendered (AC-6): HTML cached for a
     * whole description is never served for its shorter part. The entries expire, since every edit
     * leaves the previous text's entry behind.
     */
    private function html(string $prefix, PokerTask $task, ?string $markdown): string
    {
        if ($markdown === null || $markdown === '') {
            return '';
        }

        $key = "{$prefix}:{$task->id}:".hash('xxh128', $markdown);

        return Cache::remember($key, now()->addWeek(), fn (): string => $this->renderTaskMarkdown->handle($markdown));
    }
}
