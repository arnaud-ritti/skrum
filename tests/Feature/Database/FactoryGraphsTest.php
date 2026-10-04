<?php

use App\Models\ActionItem;
use App\Models\GameChoice;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GameGuess;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameStatementSet;
use App\Models\GameTextAnswer;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\TeamSurveyAnswer;

it('seats the default player of a round row in the room of that round', function (string $model) {
    $row = $model::factory()->create();

    expect($row->player->game_room_id)->toBe($row->round->game_room_id);
})->with([GameChoice::class, GameGifAnswer::class, GameGuess::class, GameTextAnswer::class]);

it('seats the default player of a statement set in its room', function () {
    $set = GameStatementSet::factory()->create();

    expect($set->player->game_room_id)->toBe($set->game_room_id);
});

it('builds a default gif vote on an answer of its round, from a voter of that room', function () {
    $vote = GameGifVote::factory()->create();

    expect($vote->answer->game_round_id)->toBe($vote->game_round_id)
        ->and($vote->voter->game_room_id)->toBe($vote->round->game_room_id);
});

it('builds a default game point in a room of its team, for a player of that room', function () {
    $point = GamePoint::factory()->create();

    expect($point->room->team_id)->toBe($point->team_id)
        ->and($point->player->game_room_id)->toBe($point->game_room_id);
});

it('takes the team of a game point from the room it is given', function () {
    $room = GameRoom::factory()->create();

    $point = GamePoint::factory()->create(['game_room_id' => $room->id]);

    expect($point->team_id)->toBe($room->team_id)
        ->and($point->player->game_room_id)->toBe($room->id);
});

it('builds a game point room in the team it is given', function () {
    $team = Team::factory()->create();

    expect(GamePoint::factory()->create(['team_id' => $team->id])->room->team_id)->toBe($team->id);
});

it('answers a survey question as a respondent of the same survey', function () {
    $answer = TeamSurveyAnswer::factory()->create();

    expect($answer->respondent->team_survey_id)->toBe($answer->question->team_survey_id);
});

it('asks for team access as a member of the team workspace', function () {
    $request = TeamAccessRequest::factory()->create();

    expect($request->team->workspace->members()->whereKey($request->user_id)->exists())->toBeTrue();
});

it('starts an action item no later than now by default', function () {
    $this->travelTo('2026-10-04 10:00:00');

    $item = ActionItem::factory()->started()->create();

    expect($item->started_at->lessThanOrEqualTo(now()))->toBeTrue();
});
