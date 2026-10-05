<?php

namespace App\Http\Controllers;

use App\Actions\Retros\GuestCookie;
use App\Actions\Retros\ResolveParticipant;
use App\Actions\Sessions\PresentJoinSession;
use App\Http\Controllers\Concerns\JoinsAsGuest;
use App\Models\Retro;
use App\Support\Avatars\PresenceColor;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class RetroJoinsController extends Controller
{
    use JoinsAsGuest;

    public function show(Request $request, string $guestToken, ResolveParticipant $resolveParticipant, PresentJoinSession $presentJoinSession): Response
    {
        $retro = $this->findRetro($guestToken);

        if ($retro === null) {
            return $this->invalidLink($request, 'retros/join');
        }

        if ($resolveParticipant->handle($request, $retro) !== null) {
            return to_route('retros.show', $retro);
        }

        return Inertia::render('retros/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'session' => $presentJoinSession->retro($retro),
            ...$presentJoinSession->nickname($request->user()),
            ...$presentJoinSession->colours($retro->participants()->with('user')->get(), $request->user()),
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, ResolveParticipant $resolveParticipant): Response
    {
        $retro = $this->findRetro($guestToken);

        if ($retro === null) {
            return $this->invalidLink($request, 'retros/join');
        }

        if ($resolveParticipant->handle($request, $retro) !== null) {
            return to_route('retros.show', $retro);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'presence' => ['sometimes', 'nullable', 'integer', 'between:1,'.PresenceColor::Count],
        ]);

        $cookie = $this->createGuest($retro->participants(), GuestCookie::RetroScope, $retro->id, [
            'guest_name' => $validated['name'],
            'presence_color' => $validated['presence'] ?? null,
        ]);

        return to_route('retros.show', $retro)->withCookie($cookie);
    }

    private function findRetro(string $guestToken): ?Retro
    {
        return Retro::query()
            ->where('guest_token', $guestToken)
            ->where('guest_access_enabled', true)
            ->first();
    }
}
