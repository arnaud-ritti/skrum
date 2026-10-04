<?php

namespace App\Http\Controllers;

use App\Actions\Retros\GuestCookie;
use App\Actions\Retros\ResolveParticipant;
use App\Actions\Sessions\PresentJoinSession;
use App\Models\Retro;
use App\Support\Avatars\PresenceColor;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class RetroJoinsController extends Controller
{
    public function show(Request $request, string $guestToken, ResolveParticipant $resolveParticipant, PresentJoinSession $presentJoinSession): Response
    {
        $retro = $this->findRetro($guestToken);

        if ($retro === null) {
            return $this->invalidLink($request);
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
            return $this->invalidLink($request);
        }

        if ($resolveParticipant->handle($request, $retro) !== null) {
            return to_route('retros.show', $retro);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'presence' => ['sometimes', 'nullable', 'integer', 'between:1,'.PresenceColor::Count],
        ]);

        $secret = Str::random(40);

        $participant = $retro->participants()->create([
            'guest_name' => $validated['name'],
            'guest_secret_hash' => hash('sha256', $secret),
            'presence_color' => $validated['presence'] ?? null,
        ]);

        return to_route('retros.show', $retro)->withCookie(GuestCookie::make(GuestCookie::RetroScope, $retro->id, $participant->id, $secret));
    }

    private function findRetro(string $guestToken): ?Retro
    {
        return Retro::query()
            ->where('guest_token', $guestToken)
            ->where('guest_access_enabled', true)
            ->first();
    }

    private function invalidLink(Request $request): Response
    {
        return Inertia::render('retros/join', ['isInvalid' => true])
            ->toResponse($request)
            ->setStatusCode(404);
    }
}
