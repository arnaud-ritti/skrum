<?php

namespace App\Support\Games;

use App\Actions\Games\DrawGameWord;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonInterface;

class HangmanRules implements GameRules
{
    public const MaxMisses = 6;

    private const int SolveBonus = 5;

    public function __construct(private DrawGameWord $drawGameWord) {}

    public function kind(): GameKind
    {
        return GameKind::Hangman;
    }

    public function isAvailable(GameRoom $room): bool
    {
        return true;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $round->word = $this->drawGameWord->handle($room, drawableOnly: false);
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        return $this->state($round, $round->revealed_positions);
    }

    public function presentEnded(GameRound $round): array
    {
        return $this->state($round, GameWord::letterPositions((string) $round->word));
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return [];
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

    /**
     * Each picker earns one point per position their hits revealed; the
     * player whose letter completed the word earns the solve bonus.
     */
    public function points(GameRound $round, GameRoom $room): array
    {
        $word = (string) $round->word;
        $rows = [];

        foreach ($round->picked_letters as $index => $letter) {
            $playerId = $round->picked_by[$index] ?? null;

            if ($playerId === null) {
                continue;
            }

            $rows[$playerId] ??= ['points' => 0, 'isWin' => false];
            $rows[$playerId]['points'] += count(GameWord::positionsOf($word, $letter));
        }

        $winner = $round->winner_player_id;

        if ($round->outcome === GameRoundOutcome::Solved && $winner !== null && isset($rows[$winner])) {
            $rows[$winner] = ['points' => $rows[$winner]['points'] + self::SolveBonus, 'isWin' => true];
        }

        return $rows;
    }

    /**
     * @param  array<int, int>  $revealedPositions
     * @return array{mask: array<int, ?string>, misses: int, maxMisses: int, pickedLetters: array<int, string>}
     */
    private function state(GameRound $round, array $revealedPositions): array
    {
        return [
            'mask' => GameWord::mask((string) $round->word, $revealedPositions),
            'misses' => $round->misses,
            'maxMisses' => self::MaxMisses,
            'pickedLetters' => $round->picked_letters,
        ];
    }
}
