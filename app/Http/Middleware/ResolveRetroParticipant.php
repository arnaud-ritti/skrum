<?php

namespace App\Http\Middleware;

use App\Actions\Retros\GuestCookie;
use App\Actions\Retros\ResolveParticipant;
use App\Http\Middleware\Concerns\RefusesMissingMember;
use App\Models\Retro;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveRetroParticipant
{
    use RefusesMissingMember;

    public function __construct(private ResolveParticipant $resolveParticipant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $retro = $request->route('retro');

        abort_unless($retro instanceof Retro, 404);

        $participant = $this->resolveParticipant->handle($request, $retro);

        if ($participant === null) {
            return $this->refuseMissingMember($request, $retro->guest_access_enabled, GuestCookie::name(GuestCookie::RetroScope, $retro->id), __('You no longer have access to this retrospective.'));
        }

        $request->attributes->set('participant', $participant);

        return $next($request);
    }
}
