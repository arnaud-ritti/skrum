<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;

class RevealGameHint
{
    public function __construct(private RevealHintLetter $revealHintLetter) {}

    /**
     * @return array{roundId: string, mask: array<int, ?string>}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): array
    {
        return DB::transaction(function () use ($room, $round, $player): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess, GameKind::Decoded);

            return ['roundId' => $lockedRound->id, 'mask' => $this->revealHintLetter->handle($lockedRoom, $lockedRound)];
        });
    }
}
