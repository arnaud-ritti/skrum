<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameDrawingOpAdded;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\DrawingOp;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AddDrawingOp
{
    /**
     * The committed copy of a stroke others already saw live: late joiners,
     * reconnects and history render from these operations only.
     *
     * @return array{roundId: string, op: array<string, mixed>, clientOpId: string}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, mixed $op, string $clientOpId): array
    {
        return DB::transaction(function () use ($room, $round, $player, $op, $clientOpId): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::DrawAndGuess);

            $parsed = DrawingOp::parse($op);
            $points = $lockedRound->drawing_points + DrawingOp::pointCount($parsed);

            if (count($lockedRound->drawing) >= DrawingOp::MaxOps || $points > DrawingOp::MaxPoints) {
                throw ValidationException::withMessages(['op' => __('The drawing is full. Clear it to keep drawing.')]);
            }

            $lockedRound->forceFill([
                'drawing' => [...$lockedRound->drawing, $parsed],
                'drawing_points' => $points,
            ])->save();

            (new GameDrawingOpAdded($lockedRoom, $lockedRound->id, $parsed, $clientOpId))->sendToOthers();

            return ['roundId' => $lockedRound->id, 'op' => $parsed, 'clientOpId' => $clientOpId];
        });
    }
}
