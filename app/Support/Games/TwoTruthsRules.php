<?php

namespace App\Support\Games;

use App\Actions\Games\GameGuard;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameVoteChanged;
use App\Models\GameChoice;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\GameStatementSet;
use Carbon\CarbonInterface;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

/**
 * Spec §6.8 (owner's answer 9 B): every player prepares a set; a round plays
 * one ready set, copied onto the round, and the others vote the lie; the lie
 * and the votes are public only once the round ends.
 */
class TwoTruthsRules implements GameRules, RevealsInStages, TakesChoices
{
    public const FinderPoints = 5;

    public const PointsPerFooled = 2;

    private const array Choices = ['0', '1', '2'];

    public function kind(): GameKind
    {
        return GameKind::TwoTruths;
    }

    public function isAvailable(GameRoom $room): bool
    {
        return true;
    }

    /**
     * Runs inside StartGameRound's transaction, the room locked: the set
     * cannot change or be played twice meanwhile.
     */
    public function prepare(GameRoom $room, GameRound $round, array $input): void
    {
        $tellerId = $input['leader_player_id'] ?? null;

        if (! is_string($tellerId) || $tellerId === '') {
            throw ValidationException::withMessages(['leader_player_id' => __('Choose who tells this round.')]);
        }

        $set = GameStatementSet::query()
            ->where('game_room_id', $room->id)
            ->where('player_id', $tellerId)
            ->whereNull('played_at')
            ->first();

        if ($set === null) {
            throw ValidationException::withMessages(['leader_player_id' => __('This player has no statements ready.')]);
        }

        $set->forceFill(['played_at' => now()])->save();

        $round->leader_player_id = $tellerId;
        $round->word = null;
        $round->statements = $set->statementsList();
        $round->lie_index = $set->lie_index;
    }

    public function presentActive(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        $choices = $round->choices()->get(['player_id', 'choice']);
        $mine = $viewer === null ? null : $choices->firstWhere('player_id', $viewer->id);
        $isTeller = $viewer !== null && $viewer->id === $round->leader_player_id;

        return [
            'statements' => $round->statementsList(),
            'voters' => $choices->pluck('player_id')->sort()->values()->all(),
            'myChoice' => $mine instanceof GameChoice ? (int) $mine->choice : null,
            ...($isTeller && $round->lie_index !== null ? ['lieIndex' => $round->lie_index] : []),
        ];
    }

    public function presentEnded(GameRound $round): array
    {
        return $this->result($round);
    }

    public function endedPayload(GameRound $round, GameRoom $room): array
    {
        return $this->result($round);
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
        return true;
    }

    public function expireTurn(GameRoom $room, GameRound $round): ?GameRoundOutcome
    {
        return GameRoundOutcome::Revealed;
    }

    /**
     * A voter who found the lie earns 5 and wins; the teller earns 2 per
     * voter fooled. A passed round pays nobody.
     */
    public function points(GameRound $round, GameRoom $room): array
    {
        $isRevealed = $round->outcome === GameRoundOutcome::Revealed;
        $rows = [];
        $fooled = 0;

        foreach ($round->choices()->get(['player_id', 'choice']) as $choice) {
            $found = $isRevealed && (int) $choice->choice === $round->lie_index;
            $fooled += $isRevealed && ! $found ? 1 : 0;
            $rows[$choice->player_id] = ['points' => $found ? self::FinderPoints : 0, 'isWin' => $found];
        }

        if ($round->leader_player_id !== null) {
            $rows[$round->leader_player_id] = ['points' => $fooled * self::PointsPerFooled, 'isWin' => false];
        }

        return $rows;
    }

    public function reveal(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $actor): ?GameRoundOutcome
    {
        GameGuard::leaderOrHost($lockedRoom, $lockedRound, $actor);

        return GameRoundOutcome::Revealed;
    }

    public function choicesFor(GameRound $lockedRound, GamePlayer $player): array
    {
        if ($lockedRound->leader_player_id === $player->id) {
            throw new AuthorizationException(__('You are telling this round, so you cannot vote.'));
        }

        return self::Choices;
    }

    public function choiceChanged(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $player, bool $chose): void
    {
        (new GameVoteChanged($lockedRoom, $lockedRound->id, $player->id, $chose))->sendToOthers();
    }

    /**
     * @return array{statements: array<int, string>, lieIndex: ?int, votes: array<int, array{index: int, playerIds: array<int, string>}>}
     */
    private function result(GameRound $round): array
    {
        $choices = $round->choices()->get(['player_id', 'choice']);

        return [
            'statements' => $round->statementsList(),
            'lieIndex' => $round->lie_index,
            'votes' => array_map(fn (int $index): array => [
                'index' => $index,
                'playerIds' => $choices->where('choice', (string) $index)->pluck('player_id')->sort()->values()->all(),
            ], array_keys($round->statementsList())),
        ];
    }
}
