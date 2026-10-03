<?php

namespace App\Actions\Teams;

use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Date;

class MemberLastActivity
{
    private const array Aggregates = ['last_retro_at', 'last_poker_at', 'last_whiteboard_at', 'last_game_at', 'last_survey_at'];

    /**
     * The latest row of each member in this team's sessions, as an ISO date, by user id.
     *
     * @return array<string, ?string>
     */
    public function handle(Team $team): array
    {
        $inTeam = fn (string $model): Builder => $model::query()->select('id')->where('team_id', $team->id);

        $members = $team->members()
            ->withMax(['retroParticipations as last_retro_at' => fn (Builder $rows) => $rows->whereIn('retro_id', $inTeam(Retro::class))], 'updated_at')
            ->withMax(['pokerPlayers as last_poker_at' => fn (Builder $rows) => $rows->whereIn('poker_game_id', $inTeam(PokerGame::class))], 'updated_at')
            ->withMax(['whiteboardMemberships as last_whiteboard_at' => fn (Builder $rows) => $rows->whereIn('whiteboard_id', $inTeam(Whiteboard::class))], 'updated_at')
            ->withMax(['gamePlayers as last_game_at' => fn (Builder $rows) => $rows->whereIn('game_room_id', $inTeam(GameRoom::class))], 'updated_at')
            ->withMax(['surveyRespondents as last_survey_at' => fn (Builder $rows) => $rows->whereIn('team_survey_id', $inTeam(TeamSurvey::class))], 'updated_at')
            ->get();

        return $members->mapWithKeys(fn (User $member): array => [$member->id => $this->latest($member)])->all();
    }

    private function latest(User $member): ?string
    {
        $dates = collect(self::Aggregates)
            ->map(fn (string $aggregate): mixed => $member->getAttribute($aggregate))
            ->filter(fn (mixed $value): bool => $value !== null)
            ->map(fn (mixed $value): CarbonInterface => Date::parse((string) $value));

        if ($dates->isEmpty()) {
            return null;
        }

        return $dates->sortDesc()->first()?->toIso8601String();
    }
}
