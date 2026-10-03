<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Jobs\RevealAutoHint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\WordGuessRules;

/**
 * Spec §6.5: the server reveals letters on its own, one per interval, up to
 * half the word; the leader's button keeps working beside it.
 */
class ScheduleAutoHints
{
    private const int UntimedInterval = 20;

    private const int ShortestInterval = 10;

    public static function interval(?int $turnSeconds, int $maxHints): int
    {
        if ($turnSeconds === null) {
            return self::UntimedInterval;
        }

        return max(self::ShortestInterval, intdiv($turnSeconds, $maxHints + 1));
    }

    public function prepare(GameRoom $room, GameRound $round): void
    {
        if (! $room->auto_hints) {
            return;
        }

        if (! in_array($round->game, [GameKind::DrawAndGuess, GameKind::Decoded], true)) {
            return;
        }

        $round->hint_seconds = self::interval($round->turn_seconds, WordGuessRules::maxHints((string) $round->word));
    }

    public function dispatch(GameRound $round): void
    {
        if ($round->hint_seconds === null) {
            return;
        }

        $maxHints = WordGuessRules::maxHints((string) $round->word);

        for ($hint = 1; $hint <= $maxHints; $hint++) {
            dispatch(new RevealAutoHint($round->id, $hint))
                ->delay($round->started_at->copy()->addSeconds($hint * $round->hint_seconds))
                ->afterCommit();
        }
    }
}
