<?php

namespace App\Actions\Poker;

use App\Actions\Integrations\PokerTaskSync;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Cache;

/**
 * @phpstan-type TaskExternal array{
 *     source: string,
 *     key: string,
 *     url: string,
 *     assignee?: ?string,
 *     sourceEstimate?: ?string,
 *     refreshedAt?: ?string,
 *     syncState?: ?string,
 *     syncError?: ?string,
 *     unsupportedReason?: ?string,
 *     isManaged: true
 * }
 * @phpstan-type Task array{
 *     id: string,
 *     title: string,
 *     description: ?string,
 *     descriptionHtml: string,
 *     position: int,
 *     estimate: ?string,
 *     estimatedAt: ?string,
 *     roundsCount: int,
 *     external: ?TaskExternal
 * }
 */
class PresentPokerTask
{
    public function __construct(private RenderTaskMarkdown $renderTaskMarkdown) {}

    /**
     * Without a PokerTaskSync (broadcasts, guests) an imported task only
     * shows its source, key and link: assignee names and sync errors stay
     * with the team (spec 6 §6.6).
     *
     * @return Task
     */
    public function handle(PokerTask $task, ?PokerTaskSync $sync = null): array
    {
        $roundsCount = $task->getAttribute('rounds_count');

        return [
            'id' => $task->id,
            'title' => $task->title,
            'description' => $task->description,
            'descriptionHtml' => $this->descriptionHtml($task),
            'position' => $task->position,
            'estimate' => $task->estimate,
            'estimatedAt' => $task->estimated_at?->toIso8601String(),
            'roundsCount' => $roundsCount === null ? $task->rounds()->count() : (int) $roundsCount,
            'external' => $this->external($task, $sync),
        ];
    }

    /**
     * @return ?TaskExternal
     */
    private function external(PokerTask $task, ?PokerTaskSync $sync): ?array
    {
        if ($task->external_source === null || $task->external_key === null || $task->external_url === null) {
            return null;
        }

        if ($sync === null) {
            return [
                'source' => $task->external_source,
                'key' => $task->external_key,
                'url' => $task->external_url,
                'isManaged' => true,
            ];
        }

        $state = $sync->state($task);

        return [
            'source' => $task->external_source,
            'key' => $task->external_key,
            'url' => $task->external_url,
            'assignee' => $task->external_assignee,
            'sourceEstimate' => $task->external_estimate,
            'refreshedAt' => $task->external_refreshed_at?->toIso8601String(),
            'syncState' => $state,
            'syncError' => $state === PokerTaskSync::Failed ? $task->sync_error : null,
            'unsupportedReason' => $state === PokerTaskSync::Unsupported ? $sync->unsupportedReason($task) : null,
            'isManaged' => true,
        ];
    }

    private function descriptionHtml(PokerTask $task): string
    {
        if ($task->description === null || $task->description === '') {
            return '';
        }

        $key = 'poker-task-description:'.$task->id.':'.hash('xxh128', $task->description);

        return Cache::rememberForever($key, fn (): string => $this->renderTaskMarkdown->handle($task->description));
    }
}
