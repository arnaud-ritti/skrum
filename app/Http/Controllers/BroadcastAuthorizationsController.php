<?php

namespace App\Http\Controllers;

use App\Actions\Games\FindGamePlayer;
use App\Actions\Poker\ResolvePlayer;
use App\Actions\Retros\ResolveParticipant;
use App\Actions\TeamSurveys\ResolveRespondent;
use App\Actions\Whiteboards\ResolveMember;
use App\Contracts\GamePresenceRoster;
use App\Enums\TeamSurveyStatus;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\Workspace;
use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Str;
use Pusher\Pusher;

class BroadcastAuthorizationsController extends Controller
{
    public function __construct(
        private ResolveParticipant $resolveParticipant,
        private ResolvePlayer $resolvePlayer,
        private FindGamePlayer $findGamePlayer,
        private GamePresenceRoster $gamePresenceRoster,
        private ResolveMember $resolveMember,
        private ResolveRespondent $resolveRespondent,
    ) {}

    public function store(Request $request): JsonResponse
    {
        /** @var array{socket_id: string, channel_name: string} $validated */
        $validated = $request->validate([
            'socket_id' => ['required', 'string', 'regex:/^\d+\.\d+$/'],
            'channel_name' => ['required', 'string'],
        ]);

        $channel = $validated['channel_name'];

        return match (true) {
            str_starts_with($channel, 'presence-game.') => $this->authorizeGameChannel($request, $validated),
            str_starts_with($channel, 'presence-survey.') => $this->authorizeSurveyChannel($request, $validated),
            str_starts_with($channel, 'presence-whiteboard.') => $this->authorizeWhiteboardChannel($request, $validated),
            str_starts_with($channel, 'presence-poker.') => $this->authorizePokerChannel($request, $validated),
            str_starts_with($channel, 'presence-retro.') => $this->authorizeRetroChannel($request, $validated),
            str_starts_with($channel, 'private-participant.') => $this->authorizeParticipantChannel($request, $validated),
            str_starts_with($channel, 'private-retro-members.') => $this->authorizeRetroMembersChannel($request, $validated),
            str_starts_with($channel, 'private-team-action-items.') => $this->authorizeTeamChannel($request, $validated, 'private-team-action-items.'),
            str_starts_with($channel, 'private-user.') => $this->authorizeUserChannel($request, $validated),
            str_starts_with($channel, 'private-team-games.') => $this->authorizeTeamChannel($request, $validated, 'private-team-games.'),
            str_starts_with($channel, 'presence-workspace-online.') => $this->authorizeWorkspaceOnlineChannel($request, $validated),
            default => abort(403),
        };
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

        return $this->sign($this->pusher()->authorizeChannel($validated['channel_name'], $validated['socket_id']));
    }

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeRetroChannel(Request $request, array $validated): JsonResponse
    {
        $retro = $this->findOr403(Retro::class, $validated['channel_name'], 'presence-retro.');
        $participant = $this->resolveParticipant->handle($request, $retro);

        abort_if($participant === null, 403);

        return $this->presence($validated, $participant, ['isObserver' => $this->observesOnly($participant, $retro)]);
    }

    /**
     * An observer of the team, who takes no part (no ROTI vote) unless they
     * facilitate, as RefuseObserverWrites lets them.
     */
    private function observesOnly(Participant $participant, Retro $retro): bool
    {
        if ($retro->isFacilitator($participant)) {
            return false;
        }

        return $participant->user?->isObserverOf($retro->team) ?? false;
    }

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizePokerChannel(Request $request, array $validated): JsonResponse
    {
        $game = $this->findOr403(PokerGame::class, $validated['channel_name'], 'presence-poker.');
        $player = $this->resolvePlayer->handle($request, $game);

        abort_if($player === null, 403);

        return $this->presence($validated, $player);
    }

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeWhiteboardChannel(Request $request, array $validated): JsonResponse
    {
        $board = $this->findOr403(Whiteboard::class, $validated['channel_name'], 'presence-whiteboard.');
        $member = $this->resolveMember->handle($request, $board);

        abort_if($member === null, 403);

        return $this->presence($validated, $member);
    }

    /**
     * Standalone rooms only (icebreakers play on the retro channel), capped
     * at twelve distinct online players; a player already online may always
     * reconnect, and an unreadable roster lets everyone in. The cap is soft:
     * the roster grows only once the socket subscribes, after this signature,
     * so a lock here could not close the gap and players who authorise at the
     * same instant may take the room a little past the cap.
     *
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeGameChannel(Request $request, array $validated): JsonResponse
    {
        $room = $this->findOr403(GameRoom::class, $validated['channel_name'], 'presence-game.');

        abort_if($room->isIcebreaker(), 403);

        $player = $this->findGamePlayer->handle($request, $room);

        abort_if($player === null, 403);

        $online = $this->gamePresenceRoster->presenceIds($room);

        abort_if(
            $online !== null && ! in_array($player->id, $online, true) && count($online) >= GameRoom::MaxOnlinePlayers,
            409,
            __('This room is full.'),
        );

        return $this->presence($validated, $player);
    }

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeParticipantChannel(Request $request, array $validated): JsonResponse
    {
        $owner = $this->findOr403(Participant::class, $validated['channel_name'], 'private-participant.');
        $participant = $this->resolveParticipant->handle($request, $owner->retro);

        abort_unless($participant?->id === $owner->id, 403);

        return $this->sign($this->pusher()->authorizeChannel($validated['channel_name'], $validated['socket_id']));
    }

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeRetroMembersChannel(Request $request, array $validated): JsonResponse
    {
        $retro = $this->findOr403(Retro::class, $validated['channel_name'], 'private-retro-members.');
        $participant = $this->resolveParticipant->handle($request, $retro);

        abort_if($participant === null || $participant->isGuest(), 403);

        return $this->sign($this->pusher()->authorizeChannel($validated['channel_name'], $validated['socket_id']));
    }

    /**
     * Only an authenticated user who can view the team: a guest cookie never
     * grants it, and a room's guest never gets the team's rooms list.
     *
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeTeamChannel(Request $request, array $validated, string $prefix): JsonResponse
    {
        abort_unless(Str::isUuid(Str::after($validated['channel_name'], $prefix)), 403);

        $user = $request->user();

        abort_if($user === null, 403);

        $team = $this->findOr403(Team::class, $validated['channel_name'], $prefix);

        abort_unless($user->can('view', $team), 403);

        return $this->sign($this->pusher()->authorizeChannel($validated['channel_name'], $validated['socket_id']));
    }

    /**
     * Who has a page of the workspace open, for "Online" in the team
     * members table: signed-in members of the workspace only, and nothing
     * about them but their user id; a guest cookie never grants it.
     *
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeWorkspaceOnlineChannel(Request $request, array $validated): JsonResponse
    {
        abort_unless(Str::isUuid(Str::after($validated['channel_name'], 'presence-workspace-online.')), 403);

        $user = $request->user();

        abort_if($user === null, 403);

        $workspace = $this->findOr403(Workspace::class, $validated['channel_name'], 'presence-workspace-online.');

        abort_unless($user->can('view', $workspace), 403);

        return $this->sign($this->pusher()->authorizePresenceChannel(
            $validated['channel_name'],
            $validated['socket_id'],
            $user->id,
            ['id' => $user->id],
        ));
    }

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeSurveyChannel(Request $request, array $validated): JsonResponse
    {
        $survey = $this->findOr403(TeamSurvey::class, $validated['channel_name'], 'presence-survey.');

        abort_if($survey->retro_id !== null, 403);

        $respondent = $this->resolveRespondent->handle($request, $survey);

        abort_if($respondent === null, 403);
        abort_if($survey->status === TeamSurveyStatus::Draft && ! $survey->isEditor($respondent), 403);

        return $this->presence($validated, $respondent);
    }

    /**
     * The row whose id follows the prefix, refused unless that id is exactly its key.
     *
     * @template TModel of Model
     *
     * @param  class-string<TModel>  $model
     * @return TModel
     */
    private function findOr403(string $model, string $channel, string $prefix): Model
    {
        $id = Str::after($channel, $prefix);

        abort_unless(Str::isUuid($id), 403);

        $found = $model::query()->find($id);

        abort_if($found === null, 403);
        abort_unless($found->getKey() === $id, 403);

        return $found;
    }

    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     * @param  array<string, bool>  $extra
     */
    private function presence(array $validated, Participant|PokerPlayer|GamePlayer|WhiteboardMember|TeamSurveyRespondent $member, array $extra = []): JsonResponse
    {
        return $this->sign($this->pusher()->authorizePresenceChannel(
            $validated['channel_name'],
            $validated['socket_id'],
            $member->id,
            [
                'id' => $member->id,
                'name' => $member->displayName(),
                'avatarUrl' => $member->avatarUrl(),
                'isGuest' => $member->isGuest(),
                'presence' => $member->presenceColor(),
                ...$extra,
            ],
        ));
    }

    private function sign(string $signature): JsonResponse
    {
        return response()->json(json_decode($signature, true));
    }

    private function pusher(): Pusher
    {
        $broadcaster = Broadcast::connection();

        abort_unless($broadcaster instanceof PusherBroadcaster, 503);

        return $broadcaster->getPusher();
    }
}
