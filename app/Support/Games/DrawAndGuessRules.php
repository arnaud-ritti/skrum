<?php

namespace App\Support\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;

class DrawAndGuessRules extends WordGuessRules
{
    public const int PointsPerFinder = 5;

    public const int WordChangesAllowed = 1;

    public function kind(): GameKind
    {
        return GameKind::DrawAndGuess;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        parent::prepare($room, $round, $input);

        $guessers = array_values(array_diff((array) ($input['guesser_player_ids'] ?? []), [$round->leader_player_id]));

        $round->guessers_total = $guessers === [] ? null : count($guessers);
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        $finders = self::finders($round);
        $isFinder = $viewer !== null && in_array($viewer->id, array_column($finders, 'playerId'), true);
        $isLeader = $viewer !== null && $viewer->id === $round->leader_player_id;

        return [
            ...parent::presentActive($round, $room, $viewer),
            'finders' => $finders,
            'guessersTotal' => $round->guessers_total,
            'pointsPerFinder' => self::PointsPerFinder,
            ...($isFinder ? ['word' => (string) $round->word] : []),
            ...($isLeader ? ['wordChangesLeft' => max(0, self::WordChangesAllowed - $round->word_changes)] : []),
        ];
    }

    public function presentEnded(GameRound $round): array
    {
        return [...parent::presentEnded($round), 'finders' => self::finders($round)];
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return ['finders' => self::finders($round)];
    }

    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return $round->hasFinders() ? GameRoundOutcome::Guessed : GameRoundOutcome::TimedOut;
    }

    public function expireTurn(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return $this->expire($room, $round);
    }

    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome
    {
        return $round->hasFinders() ? GameRoundOutcome::Guessed : null;
    }

    /**
     * Each finder by the hints shown when they found, the drawer per finder;
     * a round without guessers scores as before (one winner).
     */
    public function points(GameRound $round, GameRoom $room): array
    {
        if (! $round->keepsFinding()) {
            return parent::points($round, $room);
        }

        $isGuessed = $round->outcome === GameRoundOutcome::Guessed;
        $finders = $isGuessed ? self::finders($round) : [];
        $rows = [];

        if ($round->leader_player_id !== null) {
            $rows[$round->leader_player_id] = ['points' => self::PointsPerFinder * count($finders), 'isWin' => false];
        }

        foreach ($round->guesses()->distinct()->pluck('player_id') as $playerId) {
            $rows[(string) $playerId] ??= ['points' => 0, 'isWin' => false];
        }

        foreach ($finders as $finder) {
            $rows[$finder['playerId']] = ['points' => $finder['points'], 'isWin' => true];
        }

        return $rows;
    }

    /**
     * Who found the word, in the order they found it; the guess text never
     * leaves the server.
     *
     * @return array<int, array{playerId: string, seconds: int, points: int}>
     */
    public static function finders(GameRound $round): array
    {
        return $round->guesses()
            ->where('is_correct', true)
            ->oldest()
            ->orderBy('id')
            ->get()
            ->map(fn (GameGuess $guess): array => self::finderEntry($round, $guess))
            ->values()
            ->all();
    }

    /**
     * @return array{playerId: string, seconds: int, points: int}
     */
    public static function finderEntry(GameRound $round, GameGuess $guess): array
    {
        return [
            'playerId' => $guess->player_id,
            'seconds' => max(0, (int) $round->started_at->diffInSeconds($guess->created_at ?? now())),
            'points' => self::guesserPoints($guess->hints ?? count($round->revealed_positions)),
        ];
    }

    protected function drawableOnly(): bool
    {
        return true;
    }

    protected function board(GameRound $round): array
    {
        return ['drawing' => $round->drawing];
    }
}
