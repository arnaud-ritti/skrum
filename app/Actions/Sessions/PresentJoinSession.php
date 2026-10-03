<?php

namespace App\Actions\Sessions;

use App\Enums\TeamSurveyStatus;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Support\Avatars\PresenceColor;
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
     * The colours already worn in the session, which the picker disables
     * while a free one remains; and the visitor's own colour when it is free.
     *
     * @param  iterable<int, Participant|PokerPlayer|WhiteboardMember|TeamSurveyRespondent|GamePlayer>  $participants
     * @return array{
     *     takenColors: array<int, int>,
     *     suggestedPresence: ?int
     * }
     */
    public function colours(iterable $participants, ?User $visitor): array
    {
        $taken = collect($participants)
            ->map(fn (Participant|PokerPlayer|WhiteboardMember|TeamSurveyRespondent|GamePlayer $participant): int => $participant->presenceColor())
            ->unique()
            ->sort()
            ->values();

        $takenColors = $taken->count() >= PresenceColor::Count ? [] : $taken->all();
        $own = $visitor?->presenceColor();

        return [
            'takenColors' => $takenColors,
            'suggestedPresence' => $own !== null && ! in_array($own, $takenColors, true) ? $own : null,
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
