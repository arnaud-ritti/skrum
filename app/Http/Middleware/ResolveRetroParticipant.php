<?php

namespace App\Http\Middleware;

use App\Actions\Retros\GuestCookie;
use App\Actions\Retros\ResolveParticipant;
use App\Models\Retro;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolveRetroParticipant
{
    public function __construct(private ResolveParticipant $resolveParticipant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $retro = $request->route('retro');

        abort_unless($retro instanceof Retro, 404);

        $participant = $this->resolveParticipant->handle($request, $retro);

        if ($participant === null && $request->user() === null && ! $request->expectsJson()) {
            return $this->sendToLogin($request, $retro);
        }

        if ($participant === null) {
            $hasGuestCookie = $request->cookies->has(GuestCookie::name(GuestCookie::RetroScope, $retro->id));

            abort_if($request->user() === null && ! $hasGuestCookie, 401, __('Your session has expired.'));

            abort(403, __('You no longer have access to this retrospective.'));
        }

        $request->attributes->set('participant', $participant);

        return $next($request);
    }

    /**
     * Once the guest cookie is gone, an expired guest cannot be told apart
     * from a logged-out member, so guest-enabled retros explain both ways back.
     */
    private function sendToLogin(Request $request, Retro $retro): Response
    {
        if (! $retro->guest_access_enabled) {
            return redirect()->guest(route('login'));
        }

        redirect()->setIntendedUrl($request->fullUrl());

        return Inertia::render('retros/session-ended')->toResponse($request);
    }
}
