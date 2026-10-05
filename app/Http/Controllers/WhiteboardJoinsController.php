<?php

namespace App\Http\Controllers;

use App\Actions\Retros\GuestCookie;
use App\Actions\Sessions\PresentJoinSession;
use App\Actions\Whiteboards\ResolveMember;
use App\Http\Controllers\Concerns\JoinsAsGuest;
use App\Models\Whiteboard;
use App\Support\Avatars\PresenceColor;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class WhiteboardJoinsController extends Controller
{
    use JoinsAsGuest;

    public function show(Request $request, string $guestToken, ResolveMember $resolveMember, PresentJoinSession $presentJoinSession): Response
    {
        $board = $this->findBoard($guestToken);

        if ($board === null) {
            return $this->invalidLink($request, 'whiteboards/join');
        }

        if ($resolveMember->handle($request, $board) !== null) {
            return to_route('whiteboards.show', $board);
        }

        return Inertia::render('whiteboards/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'session' => $presentJoinSession->whiteboard($board),
            ...$presentJoinSession->nickname($request->user()),
            ...$presentJoinSession->colours($board->members()->with('user')->get(), $request->user()),
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, ResolveMember $resolveMember): Response
    {
        $board = $this->findBoard($guestToken);

        if ($board === null) {
            return $this->invalidLink($request, 'whiteboards/join');
        }

        if ($resolveMember->handle($request, $board) !== null) {
            return to_route('whiteboards.show', $board);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'presence' => ['sometimes', 'nullable', 'integer', 'between:1,'.PresenceColor::Count],
        ]);

        $cookie = $this->createGuest($board->members(), GuestCookie::WhiteboardScope, $board->id, [
            'guest_name' => $validated['name'],
            'presence_color' => $validated['presence'] ?? null,
        ]);

        return to_route('whiteboards.show', $board)
            ->withCookie($cookie);
    }

    private function findBoard(string $guestToken): ?Whiteboard
    {
        return Whiteboard::query()
            ->where('guest_token', $guestToken)
            ->where('guest_access_enabled', true)
            ->first();
    }
}
