<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameClueChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Rules\ClueEmoji;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SetGameClue
{
    public const MaxEmoji = 5;

    /**
     * The whole clue is replaced on every edit: the clue giver's client
     * sends its current row, debounced, so the last edit wins.
     *
     * @return array{roundId: string, clue: array<int, string>}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, mixed $clue): array
    {
        return DB::transaction(function () use ($room, $round, $player, $clue): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::Decoded);

            /** @var array{clue: array<int, string>} $validated */
            $validated = Validator::make(['clue' => $clue], [
                'clue' => ['present', 'array', 'list', 'max:'.self::MaxEmoji],
                'clue.*' => [new ClueEmoji],
            ], [
                'clue.max' => __('A clue holds five emoji at most.'),
            ])->validate();

            $emoji = array_values($validated['clue']);

            $lockedRound->forceFill(['clue' => $emoji])->save();

            (new GameClueChanged($lockedRoom, $lockedRound->id, $emoji))->sendToOthers();

            return ['roundId' => $lockedRound->id, 'clue' => $emoji];
        });
    }
}
