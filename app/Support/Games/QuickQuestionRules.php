<?php

namespace App\Support\Games;

use App\Actions\Games\AdvanceGameTurn;
use App\Actions\Games\PickRoundQuestion;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonInterface;

/**
 * Spec §6.11: one prompt, answered aloud in turn; the round finishes after
 * its last speaker. Played, never scored.
 */
class QuickQuestionRules implements AsksQuestions, GameRules
{
    public function __construct(
        private GameWordBook $gameWordBook,
        private PickRoundQuestion $pickRoundQuestion,
        private AdvanceGameTurn $advanceGameTurn,
    ) {}

    public function kind(): GameKind
    {
        return GameKind::QuickQuestion;
    }

    public function isAvailable(GameRoom $room): bool
    {
        return true;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $round->word = null;
        $round->question = $this->pickRoundQuestion->handle($room, $this->questions($room));
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        return ['question' => $round->question];
    }

    public function presentEnded(GameRound $round): array
    {
        return ['question' => $round->question];
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return ['question' => $round->question];
    }

    public function expiryAnchor(GameRound $round): CarbonInterface
    {
        return $round->started_at;
    }

    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return GameRoundOutcome::TimedOut;
    }

    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome
    {
        return null;
    }

    public function takesTurns(GameRoom $room): bool
    {
        return true;
    }

    public function timesTurns(): bool
    {
        return true;
    }

    public function expireTurn(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        if ($this->advanceGameTurn->handle($room, $round, wraps: false)) {
            return null;
        }

        return GameRoundOutcome::Finished;
    }

    public function points(GameRound $round, GameRoom $room): array
    {
        $order = $round->turnOrder();
        $current = array_search($round->turn_player_id, $order, true);
        $reached = $round->outcome === GameRoundOutcome::Finished || $current === false
            ? $order
            : array_slice($order, 0, $current + 1);

        return collect($reached)
            ->mapWithKeys(fn (string $playerId): array => [$playerId => ['points' => 0, 'isWin' => false]])
            ->all();
    }

    public function questions(GameRoom $room): array
    {
        return $this->gameWordBook->prompts($room->locale);
    }

    public function questionLocked(GameRound $round): bool
    {
        return $round->turn_player_id !== ($round->turnOrder()[0] ?? null);
    }
}
