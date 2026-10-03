<?php

namespace App\Http\Controllers;

use App\Actions\Games\AnnounceTeamGameRoom;
use App\Actions\Games\FindGamePlayer;
use App\Actions\Retros\GuestCookie;
use App\Actions\Sessions\PresentJoinSession;
use App\Enums\GameRoomAccess;
use App\Models\GameRoom;
use App\Support\Avatars\PresenceColor;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class GameJoinsController extends Controller
{
    public function show(Request $request, string $guestToken, FindGamePlayer $findGamePlayer, PresentJoinSession $presentJoinSession): Response
    {
        $room = $this->findRoom($guestToken);

        if ($room === null) {
            return $this->invalidLink($request);
        }

        if ($findGamePlayer->handle($request, $room) !== null) {
            return to_route('games.show', $room);
        }

        return Inertia::render('games/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'roomName' => $room->name,
            'gameLabel' => $room->game->label(),
            'session' => $presentJoinSession->game($room),
            ...$presentJoinSession->nickname($request->user()),
            ...$presentJoinSession->colours($room->players()->with(['user', 'participant.user'])->get(), $request->user()),
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, FindGamePlayer $findGamePlayer, AnnounceTeamGameRoom $announceTeamGameRoom): Response
    {
        $room = $this->findRoom($guestToken);

        if ($room === null) {
            return $this->invalidLink($request);
        }

        if ($findGamePlayer->handle($request, $room) !== null) {
            return to_route('games.show', $room);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'presence' => ['sometimes', 'nullable', 'integer', 'between:1,'.PresenceColor::Count],
        ]);

        $secret = Str::random(40);

        $player = $room->players()->create([
            'guest_name' => $validated['name'],
            'guest_secret_hash' => hash('sha256', $secret),
            'presence_color' => $validated['presence'] ?? null,
        ]);

        $announceTeamGameRoom->changed($room);

        return to_route('games.show', $room)
            ->withCookie(GuestCookie::make(GuestCookie::GameScope, $room->id, $player->id, $secret));
    }

    private function findRoom(string $guestToken): ?GameRoom
    {
        return GameRoom::query()
            ->whereNull('retro_id')
            ->where('guest_token', $guestToken)
            ->where('access', GameRoomAccess::Link)
            ->first();
    }

    private function invalidLink(Request $request): Response
    {
        return Inertia::render('games/join', ['isInvalid' => true])
            ->toResponse($request)
            ->setStatusCode(404);
    }
}
