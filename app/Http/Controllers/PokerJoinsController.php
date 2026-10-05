<?php

namespace App\Http\Controllers;

use App\Actions\Poker\ResolvePlayer;
use App\Actions\Retros\GuestCookie;
use App\Actions\Sessions\PresentJoinSession;
use App\Http\Controllers\Concerns\JoinsAsGuest;
use App\Models\PokerGame;
use App\Support\Avatars\PresenceColor;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class PokerJoinsController extends Controller
{
    use JoinsAsGuest;

    public function show(Request $request, string $guestToken, ResolvePlayer $resolvePlayer, PresentJoinSession $presentJoinSession): Response
    {
        $game = $this->findGame($guestToken);

        if ($game === null) {
            return $this->invalidLink($request, 'poker/join');
        }

        if ($resolvePlayer->handle($request, $game) !== null) {
            return to_route('poker.show', $game);
        }

        return Inertia::render('poker/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'session' => $presentJoinSession->poker($game),
            ...$presentJoinSession->nickname($request->user()),
            ...$presentJoinSession->colours($game->players()->with('user')->get(), $request->user()),
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, ResolvePlayer $resolvePlayer): Response
    {
        $game = $this->findGame($guestToken);

        if ($game === null) {
            return $this->invalidLink($request, 'poker/join');
        }

        if ($resolvePlayer->handle($request, $game) !== null) {
            return to_route('poker.show', $game);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'presence' => ['sometimes', 'nullable', 'integer', 'between:1,'.PresenceColor::Count],
            'spectator' => ['sometimes', 'boolean'],
        ]);

        $cookie = $this->createGuest($game->players(), GuestCookie::PokerScope, $game->id, [
            'guest_name' => $validated['name'],
            'is_spectator' => (bool) ($validated['spectator'] ?? false),
            'presence_color' => $validated['presence'] ?? null,
        ]);

        return to_route('poker.show', $game)
            ->withCookie($cookie);
    }

    private function findGame(string $guestToken): ?PokerGame
    {
        return PokerGame::query()
            ->where('guest_token', $guestToken)
            ->where('guest_access_enabled', true)
            ->first();
    }
}
