<?php

namespace App\Http\Controllers;

use App\Actions\Retros\ResolveParticipant;
use App\Models\Retro;
use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Str;

class BroadcastAuthorizationsController extends Controller
{
    public function store(Request $request, ResolveParticipant $resolveParticipant): JsonResponse
    {
        $validated = $request->validate([
            'socket_id' => ['required', 'string', 'regex:/^\d+\.\d+$/'],
            'channel_name' => ['required', 'string'],
        ]);

        $retroId = Str::after($validated['channel_name'], 'presence-retro.');

        abort_unless(str_starts_with($validated['channel_name'], 'presence-retro.'), 403);
        abort_unless(Str::isUuid($retroId), 403);

        $retro = Retro::query()->find($retroId);

        abort_if($retro === null, 403);
        abort_unless($retro->id === $retroId, 403);

        $participant = $resolveParticipant->handle($request, $retro);

        abort_if($participant === null, 403);

        $broadcaster = Broadcast::connection();

        abort_unless($broadcaster instanceof PusherBroadcaster, 503);

        $signature = $broadcaster->getPusher()->authorizePresenceChannel(
            $validated['channel_name'],
            $validated['socket_id'],
            $participant->id,
            [
                'id' => $participant->id,
                'name' => $participant->displayName(),
                'avatarUrl' => $participant->avatarUrl(),
                'isGuest' => $participant->isGuest(),
            ],
        );

        return response()->json(json_decode($signature, true));
    }
}
