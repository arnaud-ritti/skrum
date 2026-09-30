<?php

namespace App\Support\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonInterface;

/**
 * Everything the shared engine needs to know about one game. Rules never
 * end a round themselves: the engine does, with the outcome they return.
 */
interface GameRules
{
    public function kind(): GameKind;

    public function isAvailable(GameRoom $room): bool;

    /**
     * Fills the new, unsaved round (word, question, leader) inside the start
     * transaction, with the room locked.
     *
     * @param  array<string, mixed>  $input  the validated start request
     */
    public function prepare(GameRoom $room, GameRound $round, array $input): void;

    /**
     * Game fields of an active round as the viewer may see them; a null
     * viewer is the public view broadcast to every player.
     *
     * @return array<string, mixed>
     */
    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array;

    /**
     * @return array<string, mixed>
     */
    public function presentEnded(GameRound $round): array;

    /**
     * @return array<string, mixed>
     */
    public function endedPayload(GameRound $round, GameRoom $room): array;

    /**
     * A timer expires the round only when it ended after this instant.
     */
    public function expiryAnchor(GameRound $round): CarbonInterface;

    /**
     * The outcome that ends a round whose timer ran out, or null when the
     * rules moved the round to another stage themselves.
     */
    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome;

    /**
     * The outcome to end this active round with when the host starts the next
     * one, or null to refuse the start.
     */
    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome;

    /**
     * One entry per player who acted in the ended round, keyed by player id.
     *
     * @return array<string, array{points: int, isWin: bool}>
     */
    public function points(GameRound $round, GameRoom $room): array;
}
