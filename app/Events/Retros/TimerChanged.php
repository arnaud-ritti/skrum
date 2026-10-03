<?php

namespace App\Events\Retros;

use App\Models\Retro;

class TimerChanged extends RetroBroadcastEvent
{
    public function __construct(
        string $retroId,
        public ?string $timerEndsAt,
        public ?int $timerPausedSeconds = null,
        public ?int $topicSeconds = null,
    ) {
        parent::__construct($retroId);
    }

    public static function of(Retro $retro): self
    {
        return new self($retro->id, $retro->timer_ends_at?->toIso8601String(), $retro->timer_paused_seconds, $retro->topic_seconds);
    }

    public function broadcastAs(): string
    {
        return 'timer.changed';
    }

    /**
     * @return array{
     *     timerEndsAt: ?string,
     *     timerPausedSeconds: ?int,
     *     topicSeconds: ?int
     * }
     */
    public function broadcastWith(): array
    {
        return [
            'timerEndsAt' => $this->timerEndsAt,
            'timerPausedSeconds' => $this->timerPausedSeconds,
            'topicSeconds' => $this->topicSeconds,
        ];
    }
}
