<?php

namespace App\Actions\Sessions;

use App\Enums\TeamSurveyStatus;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Support\Sessions\GuestNames;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\OptionalProp;

class PresentJoinSession
{
    /** The longest nickname the four join `store` actions accept. */
    public const MaxNicknameLength = 50;

    /**
     * The nickname the join form opens with: the name of a signed-in visitor
     * cut to what the join accepts, a random one otherwise. `randomName` is only computed when the page asks
     * for another one.
     *
     * @return array{
     *     suggestedName: string,
     *     randomName: OptionalProp
     * }
     */
    public function nickname(?User $visitor): array
    {
        $locale = app()->getLocale();

        return [
            'suggestedName' => $visitor === null
                ? GuestNames::random($locale)
                : rtrim(Str::substr($visitor->name, 0, self::MaxNicknameLength)),
            'randomName' => Inertia::optional(fn (): string => GuestNames::random($locale)),
        ];
    }

    /**
     * @return array{
     *     title: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool,
     *     hasAnonymousCards: bool
     * }
     */
    public function retro(Retro $retro): array
    {
        return [
            'title' => $retro->title,
            'facilitatorName' => $retro->facilitator?->displayName(),
            'participantsCount' => $retro->participants()->count(),
            'isLive' => $retro->phase->isOpen(),
            'hasAnonymousCards' => $retro->is_anonymous,
        ];
    }

    /**
     * @return array{
     *     title: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool
     * }
     */
    public function poker(PokerGame $game): array
    {
        return [
            'title' => $game->title,
            'facilitatorName' => $game->facilitator?->displayName(),
            'participantsCount' => $game->players()->count(),
            'isLive' => ! $game->isEnded(),
        ];
    }

    /**
     * @return array{
     *     title: string,
     *     gameLabel: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool
     * }
     */
    public function game(GameRoom $room): array
    {
        $gameLabel = $room->game->label();

        return [
            'title' => $room->name ?? $gameLabel,
            'gameLabel' => $gameLabel,
            'facilitatorName' => $room->host?->displayName(),
            'participantsCount' => $room->players()->count(),
            'isLive' => true,
        ];
    }

    /**
     * @return array{
     *     title: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool
     * }
     */
    public function whiteboard(Whiteboard $board): array
    {
        return [
            'title' => $board->title,
            'facilitatorName' => $board->facilitator?->displayName(),
            'participantsCount' => $board->members()->count(),
            'isLive' => true,
        ];
    }

    /**
     * @return array{
     *     title: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool
     * }
     */
    public function survey(TeamSurvey $survey): array
    {
        return [
            'title' => $survey->title,
            'facilitatorName' => $survey->facilitator?->displayName(),
            'participantsCount' => $survey->participantCount(),
            'isLive' => $survey->status === TeamSurveyStatus::Open,
        ];
    }
}
