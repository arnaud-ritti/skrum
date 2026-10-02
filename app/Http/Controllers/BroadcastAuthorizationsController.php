<?php

namespace App\Http\Controllers;

use App\Actions\Games\FindGamePlayer;
use App\Actions\Poker\ResolvePlayer;
use App\Actions\Retros\ResolveParticipant;
use App\Actions\Whiteboards\ResolveMember;
use App\Contracts\GamePresenceRoster;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\Whiteboard;
use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Str;
use Pusher\Pusher;

class BroadcastAuthorizationsController extends Controller
{
    public function store(
        Request $request,
        ResolveParticipant $resolveParticipant,
        ResolvePlayer $resolvePlayer,
        FindGamePlayer $findGamePlayer,
        GamePresenceRoster $gamePresenceRoster,
        ResolveMember $resolveMember,
    ): JsonResponse {
        /** @var array{socket_id: string, channel_name: string} $validated */
        $validated = $request->validate([
            'socket_id' => ['required', 'string', 'regex:/^\d+\.\d+$/'],
            'channel_name' => ['required', 'string'],
        ]);

        if (str_starts_with($validated['channel_name'], 'presence-game.')) {
            return $this->authorizeGameChannel($request, $validated, $findGamePlayer, $gamePresenceRoster);
        }

        if (str_starts_with($validated['channel_name'], 'presence-whiteboard.')) {
            return $this->authorizeWhiteboardChannel($request, $validated, $resolveMember);
        }

        if (str_starts_with($validated['channel_name'], 'presence-poker.')) {
            return $this->authorizePokerChannel($request, $validated, $resolvePlayer);
        }

        if (str_starts_with($validated['channel_name'], 'presence-retro.')) {
            return $this->authorizeRetroChannel($request, $validated, $resolveParticipant);
        }

        if (str_starts_with($validated['channel_name'], 'private-participant.')) {
            return $this->authorizeParticipantChannel($request, $validated, $resolveParticipant);
        }

        if (str_starts_with($validated['channel_name'], 'private-retro-members.')) {
            return $this->authorizeRetroMembersChannel($request, $validated, $resolveParticipant);
        }

        if (str_starts_with($validated['channel_name'], 'private-team-action-items.')) {
            return $this->authorizeTeamActionItemsChannel($request, $validated);
        }

        if (str_starts_with($validated['channel_name'], 'private-user.')) {
            return $this->authorizeUserChannel($request, $validated);
        }

        abort(403);
    }

    /**
     * Only the signed-in user whose id the channel carries; a guest cookie
     * never grants it.
     *
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeUserChannel(Request $request, array $validated): JsonResponse
    {
        abort_unless($request->user()?->getKey() === Str::after($validated['channel_name'], 'private-user.'), 403);

        $signature = $this->pusher()->authorizeChannel($validated['channel_name'], $validated['socket_id']);

        return response()->json(json_decode($signature, true));
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
    private function authorizePokerChannel(Request $request, array $validated, ResolvePlayer $resolvePlayer): JsonResponse
    {
        $gameId = Str::after($validated['channel_name'], 'presence-poker.');

        abort_unless(Str::isUuid($gameId), 403);

        $game = PokerGame::query()->find($gameId);

        abort_if($game === null, 403);
        abort_unless($game->id === $gameId, 403);

        $player = $resolvePlayer->handle($request, $game);

        abort_if($player === null, 403);

        $signature = $this->pusher()->authorizePresenceChannel(
            $validated['channel_name'],
            $validated['socket_id'],
            $player->id,
            [
                'id' => $player->id,
                'name' => $player->displayName(),
                'avatarUrl' => $player->avatarUrl(),
                'isGuest' => $player->isGuest(),
            ],
        );

        return response()->json(json_decode($signature, true));
    }

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeWhiteboardChannel(Request $request, array $validated, ResolveMember $resolveMember): JsonResponse
    {
        $boardId = Str::after($validated['channel_name'], 'presence-whiteboard.');

        abort_unless(Str::isUuid($boardId), 403);

        $board = Whiteboard::query()->find($boardId);

        abort_if($board === null, 403);
        abort_unless($board->id === $boardId, 403);

        $member = $resolveMember->handle($request, $board);

        abort_if($member === null, 403);

        $signature = $this->pusher()->authorizePresenceChannel(
            $validated['channel_name'],
            $validated['socket_id'],
            $member->id,
            [
                'id' => $member->id,
                'name' => $member->displayName(),
                'avatarUrl' => $member->avatarUrl(),
                'isGuest' => $member->isGuest(),
            ],
        );

        return response()->json(json_decode($signature, true));
    }

    /**
     * Standalone rooms only (icebreakers play on the retro channel), capped
     * at twelve distinct online players; a player already online may always
     * reconnect, and an unreadable roster lets everyone in.
     *
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeGameChannel(Request $request, array $validated, FindGamePlayer $findGamePlayer, GamePresenceRoster $gamePresenceRoster): JsonResponse
    {
        $roomId = Str::after($validated['channel_name'], 'presence-game.');

        abort_unless(Str::isUuid($roomId), 403);

        $room = GameRoom::query()->find($roomId);

        abort_if($room === null, 403);
        abort_unless($room->id === $roomId, 403);
        abort_if($room->isIcebreaker(), 403);

        $player = $findGamePlayer->handle($request, $room);

        abort_if($player === null, 403);

        $online = $gamePresenceRoster->presenceIds($room);

        abort_if(
            $online !== null && ! in_array($player->id, $online, true) && count($online) >= GameRoom::MaxOnlinePlayers,
            403,
            __('This room is full.'),
        );

        $signature = $this->pusher()->authorizePresenceChannel(
            $validated['channel_name'],
            $validated['socket_id'],
            $player->id,
            [
                'id' => $player->id,
                'name' => $player->displayName(),
                'avatarUrl' => $player->avatarUrl(),
                'isGuest' => $player->isGuest(),
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

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeRetroMembersChannel(Request $request, array $validated, ResolveParticipant $resolveParticipant): JsonResponse
    {
        $retroId = Str::after($validated['channel_name'], 'private-retro-members.');

        abort_unless(Str::isUuid($retroId), 403);

        $retro = Retro::query()->find($retroId);

        abort_if($retro === null, 403);
        abort_unless($retro->id === $retroId, 403);

        $participant = $resolveParticipant->handle($request, $retro);

        abort_if($participant === null || $participant->isGuest(), 403);

        $signature = $this->pusher()->authorizeChannel($validated['channel_name'], $validated['socket_id']);

        return response()->json(json_decode($signature, true));
    }

    /**
     * Only an authenticated user who can view the team; a guest cookie
     * never grants it.
     *
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeTeamActionItemsChannel(Request $request, array $validated): JsonResponse
    {
        $teamId = Str::after($validated['channel_name'], 'private-team-action-items.');

        abort_unless(Str::isUuid($teamId), 403);

        $user = $request->user();

        abort_if($user === null, 403);

        $team = Team::query()->find($teamId);

        abort_if($team === null, 403);
        abort_unless($team->id === $teamId, 403);
        abort_unless($user->can('view', $team), 403);

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
