<?php

namespace App\Http\Middleware;

use App\Actions\Retros\GuestCookie;
use App\Actions\Whiteboards\ResolveMember;
use App\Models\Whiteboard;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolveWhiteboardMember
{
    public function __construct(private ResolveMember $resolveMember) {}

    public function handle(Request $request, Closure $next): Response
    {
        $board = $request->route('board');

        abort_unless($board instanceof Whiteboard, 404);

        $member = $this->resolveMember->handle($request, $board);

        if ($member === null && $request->user() === null && ! $request->expectsJson()) {
            return $this->sendToLogin($request, $board);
        }

        if ($member === null) {
            $hasGuestCookie = $request->cookies->has(GuestCookie::name(GuestCookie::WhiteboardScope, $board->id));

            abort_if($request->user() === null && ! $hasGuestCookie, 401, __('Your session has expired.'));

            abort(403, __('You no longer have access to this board.'));
        }

        $request->attributes->set('whiteboardMember', $member);

        return $next($request);
    }

    /**
     * Once the guest cookie is gone, an expired guest cannot be told apart
     * from a logged-out member, so guest-enabled boards explain both ways back.
     */
    private function sendToLogin(Request $request, Whiteboard $board): Response
    {
        if (! $board->guest_access_enabled) {
            return redirect()->guest(route('login'));
        }

        redirect()->setIntendedUrl($request->fullUrl());

        return Inertia::render('retros/session-ended')->toResponse($request);
    }
}
