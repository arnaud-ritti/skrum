<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Models\GameRoom;
use App\Models\Team;
use App\Models\User;
use App\Support\Games\GameRoomSettings;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CreateGameRoom
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private AnnounceTeamGameRoom $announceTeamGameRoom,
    ) {}

    public function handle(Team $team, User $user, string $name, GameKind $game, GameRoomAccess $access): GameRoom
    {
        return DB::transaction(function () use ($team, $user, $name, $game, $access): GameRoom {
            Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            $count = GameRoom::query()->where('team_id', $team->id)->whereNull('retro_id')->count();

            if ($count >= GameRoom::MaxRoomsPerTeam) {
                throw ValidationException::withMessages(['name' => __('This team already has 10 game rooms.')]);
            }

            $room = new GameRoom([
                'team_id' => $team->id,
                'name' => $name,
                'created_by_user_id' => $user->id,
                'game' => $game,
                'locale' => app()->getLocale(),
                'access' => $access,
                'guest_token' => Str::random(40),
                ...GameRoomSettings::forNewRoom(),
            ]);

            if (! $this->gameRulesRegistry->isAvailable($game, $room)) {
                throw ValidationException::withMessages(['game' => __('This game is not available.')]);
            }

            $room->save();

            $host = $room->players()->create(['user_id' => $user->id]);

            $room->forceFill(['host_player_id' => $host->id])->save();

            $this->announceTeamGameRoom->changed($room);

            return $room;
        });
    }
}
