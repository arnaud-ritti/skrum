<?php

namespace App\Http\Middleware;

use App\Actions\Retros\ResolveParticipant;
use App\Models\Retro;
use Closure;
use Illuminate\Http\Request;
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
            return redirect()->guest(route('login'));
        }

        abort_if($participant === null, 403);

        $request->attributes->set('participant', $participant);

        return $next($request);
    }
}
