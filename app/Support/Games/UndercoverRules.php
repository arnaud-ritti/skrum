<?php

namespace App\Support\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

class UndercoverRules implements GameRules
{
    public function __construct(private GameWordBook $gameWordBook) {}

    public function kind(): GameKind
    {
        return GameKind::Undercover;
    }

    public function isAvailable(GameRoom $room): bool
    {
        return true;
    }

    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $order = array_values($input['turn_order'] ?? []);
        $count = count($order);
        $undercoverCount = $input['undercover_count'] ?? ($count <= 6 ? 1 : ($count <= 10 ? 2 : intdiv($count, 4)));

        if ($count < 3 || $count > GameRoom::MaxOnlinePlayers || $undercoverCount < 1 || $undercoverCount * 2 >= $count) {
            throw ValidationException::withMessages(['undercover_count' => __('Undercover needs at least 3 players and a civilian majority.')]);
        }

        $pairs = $this->gameWordBook->undercoverPairs($room->locale);
        $pair = collect($pairs)->random();
        if (random_int(0, 1) === 1) {
            $pair = array_reverse($pair);
        }
        $undercoverIds = collect($order)->shuffle()->take($undercoverCount)->all();
        $roles = [];
        foreach ($order as $playerId) {
            $roles[$playerId] = in_array($playerId, $undercoverIds, true) ? 'undercover' : 'civilian';
        }

        $round->word = null;
        $round->undercover_state = [
            'words' => ['civilian' => $pair[0], 'undercover' => $pair[1]],
            'roles' => $roles,
            'order' => $order,
            'eliminated' => [],
            'stage' => 'clues',
            'cycle' => 1,
            'version' => 1,
            'candidates' => [],
            'winner' => null,
        ];
    }

    /** @return array<string, mixed> */
    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        $state = $round->undercover_state;
        $role = $viewer === null ? null : ($state['roles'][$viewer->id] ?? null);

        return ['undercover' => [
            'stage' => $state['stage'],
            'cycle' => $state['cycle'],
            'version' => $state['version'],
            'playerIds' => $state['order'],
            'eliminated' => array_map(fn (string $id): array => ['playerId' => $id, 'role' => $state['roles'][$id]], $state['eliminated']),
            'candidates' => $state['candidates'],
            'myWord' => $role === null ? null : $state['words'][$role],
            'myVote' => $viewer === null ? null : $round->choices()->where('player_id', $viewer->id)->value('choice'),
            'votedCount' => $round->choices()->count(),
        ]];
    }

    /** @return array<string, mixed> */
    public function presentEnded(GameRound $round): array
    {
        $state = $round->undercover_state;

        return ['undercoverResult' => [
            'words' => $state['words'],
            'winner' => $round->outcome === GameRoundOutcome::Finished ? $state['winner'] : null,
            'players' => array_map(fn (string $id): array => ['playerId' => $id, 'role' => $state['roles'][$id], 'eliminated' => in_array($id, $state['eliminated'], true)], $state['order']),
        ]];
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return $this->presentEnded($round);
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
        return false;
    }

    public function expireTurn(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        throw ValidationException::withMessages(['round' => __('Use the Undercover controls to advance this game.')]);
    }

    /** @return array<string, array{points: int, isWin: bool}> */
    public function points(GameRound $round, GameRoom $room): array
    {
        $state = $round->undercover_state;
        $winner = $round->outcome === GameRoundOutcome::Finished ? $state['winner'] : null;
        $points = [];
        foreach ($state['roles'] as $id => $role) {
            $won = $winner !== null && $role === $winner;
            $points[$id] = ['points' => $won ? 5 : 0, 'isWin' => $won];
        }

        return $points;
    }
}
