<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Events\Retros\CardHighlighted;
use App\Events\Retros\TimerChanged;
use App\Events\Retros\TopicDiscussed;
use App\Models\Retro;

/**
 * The shared topic changes. In Discussing, moving from one topic to another
 * marks the topic left as discussed and restarts the timer for the time per
 * topic, when there is one.
 */
class MoveTopicFocus
{
    /**
     * Runs inside the caller's transaction, on the retro row locked for update.
     *
     * @return array{
     *     timer: array{timerEndsAt: ?string, timerPausedSeconds: ?int, topicSeconds: ?int},
     *     discussed: ?array{cardId: string, discussedAt: string}
     * }
     */
    public function handle(Retro $locked, ?string $cardId): array
    {
        $previous = $locked->highlighted_card_id;

        $locked->update(['highlighted_card_id' => $cardId]);

        new CardHighlighted($locked->id, $cardId)->sendToOthers();

        if (! $this->movesOn($locked, $previous, $cardId)) {
            return ['timer' => TimerChanged::of($locked)->broadcastWith(), 'discussed' => null];
        }

        $discussed = $this->markLeftTopic($locked, $previous);

        $this->restartTopicTimer($locked);

        return ['timer' => TimerChanged::of($locked)->broadcastWith(), 'discussed' => $discussed];
    }

    private function movesOn(Retro $locked, ?string $previous, ?string $cardId): bool
    {
        if ($locked->phase !== RetroPhase::Discussing) {
            return false;
        }

        if ($previous === null) {
            return $cardId !== null && $locked->topic_seconds !== null;
        }

        if ($cardId === null) {
            return false;
        }

        return $cardId !== $previous;
    }

    /**
     * @return ?array{cardId: string, discussedAt: string}
     */
    private function markLeftTopic(Retro $locked, ?string $previous): ?array
    {
        if ($previous === null) {
            return null;
        }

        $topic = $locked->cards()->whereKey($previous)->whereNull('parent_card_id')->whereNull('discussed_at')->first();

        if ($topic === null) {
            return null;
        }

        $topic->update(['discussed_at' => now()]);

        $discussedAt = (string) $topic->discussed_at?->toIso8601String();

        new TopicDiscussed($locked->id, $topic->id, $discussedAt)->sendToOthers();

        return ['cardId' => $topic->id, 'discussedAt' => $discussedAt];
    }

    private function restartTopicTimer(Retro $locked): void
    {
        if ($locked->topic_seconds === null) {
            return;
        }

        $locked->update([
            'timer_ends_at' => now()->addSeconds($locked->topic_seconds)->startOfSecond(),
            'timer_paused_seconds' => null,
        ]);

        TimerChanged::of($locked)->sendToOthers();
    }
}
