<?php

namespace App\Actions\Poker;

use App\Models\PokerTask;
use Illuminate\Support\Facades\Cache;

class PresentPokerTask
{
    public function __construct(private RenderTaskMarkdown $renderTaskMarkdown) {}

    /**
     * External references stay null until the tracker imports of spec 6.
     *
     * @return array{
     *     id: string,
     *     title: string,
     *     description: ?string,
     *     descriptionHtml: string,
     *     position: int,
     *     estimate: ?string,
     *     estimatedAt: ?string,
     *     roundsCount: int,
     *     external: null
     * }
     */
    public function handle(PokerTask $task): array
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
            'external' => null,
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
