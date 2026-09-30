<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PokerFacilitatorsController extends Controller
{
    public function update(Request $request, PokerGame $game): Response
    {
        $player = PokerPlayer::current($request);

        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
        ]);

        $user = User::query()->whereKey($validated['user_id'])->firstOrFail();

        DB::transaction(function () use ($game, $player, $user): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            $locked->isFacilitator($player)
                ? $this->ensureCanHandOver($locked, $user)
                : $this->ensureTakesControl($locked, $player, $user);

            $newFacilitator = PokerPlayer::query()->firstOrCreate(['poker_game_id' => $locked->id, 'user_id' => $user->id]);

            $locked->update(['facilitator_player_id' => $newFacilitator->id]);

            (new PokerGameChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    private function ensureCanHandOver(PokerGame $locked, User $user): void
    {
        PokerGuard::notEnded($locked);

        if ($user->can('view', $locked->team)) {
            return;
        }

        throw ValidationException::withMessages(['user_id' => __('The facilitator must be a member of this team.')]);
    }

    /**
     * A missing facilitator would freeze a game that spans days, so any
     * non-guest player of the team may make themselves facilitator, also
     * on an ended game, which only a facilitator can reopen.
     */
    private function ensureTakesControl(PokerGame $locked, PokerPlayer $player, User $user): void
    {
        if ($player->isGuest() || $player->user_id !== $user->id || ! $user->can('view', $locked->team)) {
            throw new AuthorizationException(__('Only the facilitator can do this.'));
        }
    }
}
