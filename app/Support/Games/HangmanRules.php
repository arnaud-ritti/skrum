<?php

namespace App\Support\Games;

use App\Actions\Games\AdvanceGameTurn;
use App\Actions\Games\DrawGameWord;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonInterface;

class HangmanRules implements GameRules
{
    public const MaxMisses = 6;

    public const WordGuessesShown = 10;

    private const int SolveBonus = 5;

    public function __construct(
        private DrawGameWord $drawGameWord,
        private AdvanceGameTurn $advanceGameTurn,
    ) {}

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
        return [...$this->state($round, $round->revealed_positions), 'wordGuesses' => $this->wordGuesses($round)];
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

    public function takesTurns(GameRoom $room): bool
    {
        return $room->takes_turns;
    }

    public function timesTurns(): bool
    {
        return true;
    }

    /**
     * A turn that runs out passes to the next player with no penalty; a
     * round without turns is its own turn and times out.
     */
    public function expireTurn(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        if (! $round->takesTurns()) {
            return GameRoundOutcome::TimedOut;
        }

        $this->advanceGameTurn->handle($room, $round);

        return null;
    }

    /**
     * Each picker earns one point per position their hits revealed; the
     * player whose letter or whole-word guess solved it earns the solve
     * bonus; a player whose only move was a wrong word guess gets a row.
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

        foreach ($round->guesses()->distinct()->pluck('player_id') as $playerId) {
            $rows[(string) $playerId] ??= ['points' => 0, 'isWin' => false];
        }

        $winner = $round->winner_player_id;

        if ($round->outcome === GameRoundOutcome::Solved && $winner !== null) {
            $rows[$winner] = ['points' => ($rows[$winner]['points'] ?? 0) + self::SolveBonus, 'isWin' => true];
        }

        return $rows;
    }

    /**
     * @return array<int, array{playerId: string, text: string}>
     */
    private function wordGuesses(GameRound $round): array
    {
        return $round->guesses()
            ->where('is_correct', false)
            ->latest()
            ->orderByDesc('id')
            ->limit(self::WordGuessesShown)
            ->get(['player_id', 'text'])
            ->reverse()
            ->map(fn (GameGuess $guess): array => ['playerId' => $guess->player_id, 'text' => $guess->text])
            ->values()
            ->all();
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
