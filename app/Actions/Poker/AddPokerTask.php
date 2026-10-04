<?php

namespace App\Actions\Poker;

use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Validation\ValidationException;

class AddPokerTask
{
    public const MaxTasks = 200;

    public function __construct(private PresentPokerTask $presentPokerTask) {}

    public function handle(PokerGame $locked, string $title, ?string $description): PokerTask
    {
        if ($locked->tasks()->count() >= self::MaxTasks) {
            throw ValidationException::withMessages(['title' => __('This game already has 200 tasks.')]);
        }

        $task = $locked->tasks()->create([
            'title' => $title,
            'description' => $description,
            'position' => (int) $locked->tasks()->max('position') + 1,
        ]);

        $task->loadCount('rounds');

        new PokerTaskSaved($locked->id, $this->presentPokerTask->handle($task))->sendToOthers();

        return $task;
    }
}
