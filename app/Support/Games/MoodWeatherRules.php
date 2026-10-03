<?php

namespace App\Support\Games;

use App\Actions\Games\GameGuard;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\GameWeather;
use App\Events\Games\GameAnswerChanged;
use App\Models\GameChoice;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonInterface;

/**
 * Spec §6.9: everyone picks a weather; at the reveal the team sees how many
 * picked each one, never who, and nothing under three answers.
 */
class MoodWeatherRules implements GameRules, RevealsInStages, TakesChoices
{
    public const Threshold = 3;

    public function kind(): GameKind
    {
        return GameKind::MoodWeather;
    }

    public function isAvailable(GameRoom $room): bool
    {
        return true;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $round->word = null;
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        $choices = $round->choices()->get(['player_id', 'choice']);
        $mine = $viewer === null ? null : $choices->firstWhere('player_id', $viewer->id);

        return [
            'answers' => $choices->pluck('player_id')->sort()->values()
                ->map(fn (string $playerId): array => ['playerId' => $playerId, 'answered' => true])
                ->all(),
            'myChoice' => $mine instanceof GameChoice ? $mine->choice : null,
            'threshold' => self::Threshold,
        ];
    }

    public function presentEnded(GameRound $round): array
    {
        return $this->weather($round);
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return $this->weather($round);
    }

    public function expiryAnchor(GameRound $round): CarbonInterface
    {
        return $round->started_at;
    }

    public function expire(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return GameRoundOutcome::Revealed;
    }

    public function outcomeOnNextRound(GameRound $round): ?GameRoundOutcome
    {
        return null;
    }

    public function takesTurns(GameRoom $room): bool
    {
        return false;
    }

    public function timesTurns(): bool
    {
        return false;
    }

    public function expireTurn(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return null;
    }

    /**
     * Played, never scored: a point would tell a weather from its author.
     */
    public function points(GameRound $round, GameRoom $room): array
    {
        if ($round->outcome !== GameRoundOutcome::Revealed) {
            return [];
        }

        return $round->choices()->pluck('player_id')
            ->mapWithKeys(fn (string $playerId): array => [$playerId => ['points' => 0, 'isWin' => false]])
            ->all();
    }

    public function reveal(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $actor): ?GameRoundOutcome
    {
        GameGuard::host($lockedRoom, $actor);

        return GameRoundOutcome::Revealed;
    }

    public function choicesFor(GameRound $lockedRound, GamePlayer $player): array
    {
        return array_map(fn (GameWeather $weather): string => $weather->value, GameWeather::cases());
    }

    public function choiceChanged(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $player, bool $chose): void
    {
        (new GameAnswerChanged($lockedRoom, $lockedRound->id, $player->id, $chose))->sendToOthers();
    }

    /**
     * @return array{answered: int, weather: ?array<int, array{weather: string, count: int}>}
     */
    private function weather(GameRound $round): array
    {
        $counts = $round->choices()->pluck('choice')->countBy();
        $answered = (int) $counts->sum();

        if ($answered < self::Threshold) {
            return ['answered' => $answered, 'weather' => null];
        }

        return [
            'answered' => $answered,
            'weather' => array_map(fn (GameWeather $weather): array => [
                'weather' => $weather->value,
                'count' => (int) ($counts[$weather->value] ?? 0),
            ], GameWeather::cases()),
        ];
    }
}
