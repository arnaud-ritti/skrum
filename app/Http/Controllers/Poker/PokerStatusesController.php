<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PokerStatusesController extends Controller
{
    /**
     * The only mutation allowed on an ended game besides deletion, since
     * reopening is the way back.
     */
    public function update(Request $request, PokerGame $game): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'ended' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($game, $player, $validated): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::facilitator($locked, $player);

            $locked->update($validated['ended']
                ? ['ended_at' => $locked->ended_at ?? now(), 'current_task_id' => null]
                : ['ended_at' => null]);

            (new PokerGameChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }
}
