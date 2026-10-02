<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\BuildGameSnapshot;
use App\Actions\Games\GameGuard;
use App\Enums\GameRoomAccess;
use App\Events\Games\GameRoomChanged;
use App\Events\Games\GameRoomDeleted;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class GameRoomsController extends Controller
{
    public function show(Request $request, GameRoom $room, BuildGameSnapshot $buildGameSnapshot): Response
    {
        if ($room->retro_id !== null) {
            return to_route('retros.show', $room->retro_id);
        }

        return Inertia::render('games/show', [
            'snapshot' => $buildGameSnapshot->handle($room, GamePlayer::current($request)),
        ])->toResponse($request);
    }

    public function update(Request $request, GameRoom $room): HttpResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::manager($room, $player);

        $locales = Rule::in(config('skrum.locales'));

        $validated = $request->validate($room->isIcebreaker()
            ? [
                'locale' => ['required', 'string', $locales],
                'name' => ['prohibited'],
                'access' => ['prohibited'],
                'reactions_enabled' => ['prohibited'],
            ]
            : [
                'name' => ['sometimes', 'required', 'string', 'max:60'],
                'access' => ['sometimes', 'required', Rule::enum(GameRoomAccess::class)],
                'locale' => ['sometimes', 'required', 'string', $locales],
                'reactions_enabled' => ['sometimes', 'boolean'],
            ]);

        DB::transaction(function () use ($room, $player, $validated): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::manager($locked, $player);

            $locked->update($validated);

            (new GameRoomChanged($locked))->sendToOthers();
        });

        return response()->noContent();
    }

    public function destroy(Request $request, GameRoom $room): HttpResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);
        GameGuard::canDelete($room, $player);

        DB::transaction(function () use ($room, $player): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::canDelete($locked, $player);

            $event = new GameRoomDeleted($locked);

            $locked->delete();

            $event->sendToOthers();
        });

        return response()->noContent();
    }
}
