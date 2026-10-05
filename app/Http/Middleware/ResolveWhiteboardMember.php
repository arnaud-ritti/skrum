<?php

namespace App\Http\Middleware;

use App\Actions\Retros\GuestCookie;
use App\Actions\Whiteboards\ResolveMember;
use App\Http\Middleware\Concerns\RefusesMissingMember;
use App\Models\Whiteboard;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveWhiteboardMember
{
    use RefusesMissingMember;

    public function __construct(private ResolveMember $resolveMember) {}

    public function handle(Request $request, Closure $next): Response
    {
        $board = $request->route('board');

        abort_unless($board instanceof Whiteboard, 404);

        $member = $this->resolveMember->handle($request, $board);

        if ($member === null) {
            return $this->refuseMissingMember($request, $board->guest_access_enabled, GuestCookie::name(GuestCookie::WhiteboardScope, $board->id), __('You no longer have access to this board.'));
        }

        $request->attributes->set('whiteboardMember', $member);

        return $next($request);
    }
}
