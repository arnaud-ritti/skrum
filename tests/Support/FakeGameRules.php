<?php

namespace Tests\Support;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRules;
use Carbon\CarbonInterface;

/**
 * Game-agnostic rules for engine tests: every decision is a public knob.
 */
class FakeGameRules implements GameRules
{
    /**
     * @param  array<string, array{points: int, isWin: bool}>  $points
     */
    public function __construct(
        public GameKind $kind = GameKind::Hangman,
        public string $word = 'engine',
        public bool $available = true,
        public ?GameRoundOutcome $nextRoundOutcome = null,
        public array $points = [],
        public ?GameRoundOutcome $expiryOutcome = GameRoundOutcome::TimedOut,
    ) {}

    public function kind(): GameKind
    {
        return $this->kind;
    }

    public function isAvailable(GameRoom $room): bool
    {
        return $this->available;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $round->word = $this->word;

        if (isset($input['leader_player_id']) && is_string($input['leader_player_id'])) {
            $round->leader_player_id = $input['leader_player_id'];
        }
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        return ['fake' => true, 'viewerPlayerId' => $viewer?->id];
    }

    public function presentEnded(GameRound $round): array
    {
        return ['fakeDetail' => true];
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return ['fakeExtra' => true];
    }

    public function expiryAnchor(GameRound $round): CarbonInterface
    {
        return $round->started_at;
    }

    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return $this->expiryOutcome;
    }

    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome
    {
        return $this->nextRoundOutcome;
    }

    public function points(GameRound $round, GameRoom $room): array
    {
        return $this->points;
    }
}
