<?php

namespace App\Support\Games;

use App\Actions\Games\DrawGameWord;
use App\Enums\GameRoundOutcome;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * Draw & Guess and Decoded: a leader knows the word, the others guess in a
 * chat. Only the leader ever receives the word from here; correct guesses
 * are never presented, and "very close" is shown to its guesser only.
 */
abstract class WordGuessRules implements GameRules
{
    public const GuessesShown = 50;

    private const LeaderPoints = 5;

    private const GuessPointsStart = 10;

    private const GuessPointsPerHint = 2;

    private const GuessPointsFloor = 4;

    public function __construct(private DrawGameWord $drawGameWord) {}

    abstract protected function drawableOnly(): bool;

    /**
     * The game's own field (drawing or clue), shown while active and after.
     *
     * @return array<string, mixed>
     */
    abstract protected function board(GameRound $round): array;

    public static function maxHints(string $word): int
    {
        return intdiv(count(GameWord::letterPositions($word)), 2);
    }

    public static function guesserPoints(int $hints): int
    {
        return max(self::GuessPointsStart - self::GuessPointsPerHint * $hints, self::GuessPointsFloor);
    }

    public function isAvailable(GameRoom $room): bool
    {
        return true;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $leaderId = $input['leader_player_id'] ?? null;

        if (! is_string($leaderId) || $leaderId === '') {
            throw ValidationException::withMessages(['leader_player_id' => __('Choose who leads this round.')]);
        }

        $round->leader_player_id = $leaderId;
        $round->word = $this->drawGameWord->handle($room, $this->drawableOnly());
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        $word = (string) $round->word;
        $isLeader = $viewer !== null && $viewer->id === $round->leader_player_id;

        return [
            'mask' => GameWord::mask($word, $round->revealed_positions),
            'maxHints' => self::maxHints($word),
            'guesses' => $this->guesses($round, $viewer),
            ...$this->board($round),
            ...($isLeader ? ['word' => $word] : []),
        ];
    }

    public function presentEnded(GameRound $round): array
    {
        $word = (string) $round->word;

        return [
            'mask' => GameWord::mask($word, GameWord::letterPositions($word)),
            ...$this->board($round),
        ];
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
     * The leader always took part; every guesser gets a row, and only a
     * guessed round pays: the winner by hints used, the leader a flat bonus.
     */
    public function points(GameRound $round, GameRoom $room): array
    {
        $isGuessed = $round->outcome === GameRoundOutcome::Guessed;
        $rows = [];

        if ($round->leader_player_id !== null) {
            $rows[$round->leader_player_id] = ['points' => $isGuessed ? self::LeaderPoints : 0, 'isWin' => false];
        }

        foreach ($round->guesses()->distinct()->pluck('player_id') as $playerId) {
            $rows[(string) $playerId] ??= ['points' => 0, 'isWin' => false];
        }

        if ($isGuessed && $round->winner_player_id !== null) {
            $rows[$round->winner_player_id] = [
                'points' => self::guesserPoints(count($round->revealed_positions)),
                'isWin' => true,
            ];
        }

        return $rows;
    }

    /**
     * @return array<int, array{id: string, playerId: string, text: string, veryClose?: true}>
     */
    private function guesses(GameRound $round, ?GamePlayer $viewer): array
    {
        return $round->guesses()
            ->where('is_correct', false)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::GuessesShown)
            ->get()
            ->reverse()
            ->map(fn (GameGuess $guess): array => [
                'id' => $guess->id,
                'playerId' => $guess->player_id,
                'text' => $guess->text,
                ...($guess->is_near_miss && $viewer !== null && $guess->player_id === $viewer->id ? ['veryClose' => true] : []),
            ])
            ->values()
            ->all();
    }
}
