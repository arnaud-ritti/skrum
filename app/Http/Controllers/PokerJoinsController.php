<?php

namespace App\Http\Controllers;

use App\Actions\Poker\ResolvePlayer;
use App\Actions\Retros\GuestCookie;
use App\Actions\Sessions\PresentJoinSession;
use App\Models\PokerGame;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class PokerJoinsController extends Controller
{
    public function show(Request $request, string $guestToken, ResolvePlayer $resolvePlayer, PresentJoinSession $presentJoinSession): Response
    {
        $game = $this->findGame($guestToken);

        if ($game === null) {
            return $this->invalidLink($request);
        }

        if ($resolvePlayer->handle($request, $game) !== null) {
            return to_route('poker.show', $game);
        }

        return Inertia::render('poker/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'gameTitle' => $game->title,
            'session' => $presentJoinSession->poker($game),
            'suggestedName' => $request->user()?->name,
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, ResolvePlayer $resolvePlayer): Response
    {
        $game = $this->findGame($guestToken);

        if ($game === null) {
            return $this->invalidLink($request);
        }

        if ($resolvePlayer->handle($request, $game) !== null) {
            return to_route('poker.show', $game);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'spectator' => ['sometimes', 'boolean'],
        ]);

        $secret = Str::random(40);

        $player = $game->players()->create([
            'guest_name' => $validated['name'],
            'guest_secret_hash' => hash('sha256', $secret),
            'is_spectator' => (bool) ($validated['spectator'] ?? false),
        ]);

        return to_route('poker.show', $game)
            ->withCookie(GuestCookie::make(GuestCookie::PokerScope, $game->id, $player->id, $secret));
    }

    private function findGame(string $guestToken): ?PokerGame
    {
        return PokerGame::query()
            ->where('guest_token', $guestToken)
            ->where('guest_access_enabled', true)
            ->first();
    }

    private function invalidLink(Request $request): Response
    {
        return Inertia::render('poker/join', ['isInvalid' => true])
            ->toResponse($request)
            ->setStatusCode(404);
    }
}
