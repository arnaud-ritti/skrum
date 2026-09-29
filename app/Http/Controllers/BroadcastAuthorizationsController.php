<?php

namespace App\Http\Controllers;

use App\Actions\Retros\ResolveParticipant;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Str;
use Pusher\Pusher;

class BroadcastAuthorizationsController extends Controller
{
    public function store(Request $request, ResolveParticipant $resolveParticipant): JsonResponse
    {
        /** @var array{socket_id: string, channel_name: string} $validated */
        $validated = $request->validate([
            'socket_id' => ['required', 'string', 'regex:/^\d+\.\d+$/'],
            'channel_name' => ['required', 'string'],
        ]);

        if (str_starts_with($validated['channel_name'], 'presence-retro.')) {
            return $this->authorizeRetroChannel($request, $validated, $resolveParticipant);
        }

        if (str_starts_with($validated['channel_name'], 'private-participant.')) {
            return $this->authorizeParticipantChannel($request, $validated, $resolveParticipant);
        }

        abort(403);
    }

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeRetroChannel(Request $request, array $validated, ResolveParticipant $resolveParticipant): JsonResponse
    {
        $retroId = Str::after($validated['channel_name'], 'presence-retro.');

        abort_unless(Str::isUuid($retroId), 403);

        $retro = Retro::query()->find($retroId);

        abort_if($retro === null, 403);
        abort_unless($retro->id === $retroId, 403);

        $participant = $resolveParticipant->handle($request, $retro);

        abort_if($participant === null, 403);

        $signature = $this->pusher()->authorizePresenceChannel(
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

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeParticipantChannel(Request $request, array $validated, ResolveParticipant $resolveParticipant): JsonResponse
    {
        $participantId = Str::after($validated['channel_name'], 'private-participant.');

        abort_unless(Str::isUuid($participantId), 403);

        $owner = Participant::query()->find($participantId);

        abort_if($owner === null, 403);
        abort_unless($owner->id === $participantId, 403);

        $participant = $resolveParticipant->handle($request, $owner->retro);

        abort_unless($participant?->id === $owner->id, 403);

        $signature = $this->pusher()->authorizeChannel($validated['channel_name'], $validated['socket_id']);

        return response()->json(json_decode($signature, true));
    }

    private function pusher(): Pusher
    {
        $broadcaster = Broadcast::connection();

        abort_unless($broadcaster instanceof PusherBroadcaster, 503);

        return $broadcaster->getPusher();
    }
}
