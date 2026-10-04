<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\AnnounceTeamGameRoom;
use App\Actions\Games\GameGuard;
use App\Events\Games\GameRoomChanged;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class GameHostsController extends Controller
{
    /**
     * The host hands hosting to a member player; the creator, workspace
     * Owners/Admins and the team's facilitators and owners can take it at
     * any time, so a room never stays stuck.
     */
    public function update(Request $request, GameRoom $room, AnnounceTeamGameRoom $announceTeamGameRoom): Response
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);

        $validated = $request->validate([
            'player_id' => ['required', 'string', 'uuid', Rule::exists('game_players', 'id')->where('game_room_id', $room->id)],
        ]);

        DB::transaction(function () use ($room, $player, $validated, $announceTeamGameRoom): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();
            $target = GamePlayer::query()->with('user')->whereKey($validated['player_id'])->where('game_room_id', $locked->id)->firstOrFail();

            if ($target->id === $player->id) {
                $this->ensureCanTakeHosting($locked, $player);
            } else {
                GameGuard::host($locked, $player);
            }

            if ($target->isGuest() || ! ($target->user?->can('view', $locked->team) ?? false)) {
                throw ValidationException::withMessages(['player_id' => __('Only a team member can host.')]);
            }

            $locked->update(['host_player_id' => $target->id]);

            new GameRoomChanged($locked)->sendToOthers();

            $announceTeamGameRoom->changed($locked);
        });

        return response()->noContent();
    }

    private function ensureCanTakeHosting(GameRoom $room, GamePlayer $player): void
    {
        if ($room->isHost($player) || $room->isCreator($player)) {
            return;
        }

        if ($player->account()?->can('takeControl', $room->team) ?? false) {
            return;
        }

        throw new AuthorizationException(__('Only the room creator or a workspace admin can take hosting.'));
    }
}
