<?php

namespace App\Http\Middleware;

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
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * An observer of a team follows its sessions and changes nothing in them, unless
 * they already facilitate the session. Runs after the middleware that resolves
 * who is in the session.
 */
class RefuseObserverWrites
{
    private const array SessionParameters = ['retro', 'game', 'board', 'room', 'teamSurvey'];

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethodSafe()) {
            return $next($request);
        }

        $user = $request->user();
        $team = $this->team($request);

        if ($user === null || $team === null) {
            return $next($request);
        }

        if (! $user->isObserverOf($team)) {
            return $next($request);
        }

        if ($this->facilitates($request)) {
            return $next($request);
        }

        abort(403, __('Observers can follow this session but not take part.'));
    }

    private function team(Request $request): ?Team
    {
        foreach (self::SessionParameters as $parameter) {
            $session = $request->route($parameter);

            if ($session instanceof Retro || $session instanceof PokerGame || $session instanceof Whiteboard || $session instanceof GameRoom || $session instanceof TeamSurvey) {
                return $session->team;
            }
        }

        return null;
    }

    private function facilitates(Request $request): bool
    {
        $retro = $request->route('retro');
        $participant = $request->attributes->get('participant');

        if ($retro instanceof Retro && $participant instanceof Participant) {
            return $retro->isFacilitator($participant);
        }

        $game = $request->route('game');
        $player = $request->attributes->get('pokerPlayer');

        if ($game instanceof PokerGame && $player instanceof PokerPlayer) {
            return $game->isFacilitator($player);
        }

        $board = $request->route('board');
        $member = $request->attributes->get('whiteboardMember');

        if ($board instanceof Whiteboard && $member instanceof WhiteboardMember) {
            return $board->isFacilitator($member);
        }

        $room = $request->route('room');
        $gamePlayer = $request->attributes->get('gamePlayer');

        if ($room instanceof GameRoom && $gamePlayer instanceof GamePlayer) {
            return $room->isHost($gamePlayer);
        }

        $survey = $request->route('teamSurvey');
        $respondent = $request->attributes->get('surveyRespondent');

        if ($survey instanceof TeamSurvey && $respondent instanceof TeamSurveyRespondent) {
            return $survey->isEditor($respondent);
        }

        return false;
    }
}
