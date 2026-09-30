<?php

namespace Database\Factories;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameRound>
 */
class GameRoundFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_room_id' => GameRoom::factory(),
            'game' => GameKind::Hangman,
            'word' => 'sprint',
            'started_at' => now()->startOfSecond(),
        ];
    }

    public function game(GameKind $game): static
    {
        return $this->state(fn () => ['game' => $game]);
    }

    public function word(string $word): static
    {
        return $this->state(fn () => ['word' => $word]);
    }

    public function ledBy(GamePlayer $player): static
    {
        return $this->state(fn () => ['leader_player_id' => $player->id]);
    }

    public function ended(GameRoundOutcome $outcome = GameRoundOutcome::Solved): static
    {
        return $this->state(fn () => ['outcome' => $outcome, 'ended_at' => now()->startOfSecond()]);
    }
}
