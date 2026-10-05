<?php

use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\User;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
});

function surveyChannelRequest(TeamSurvey $survey): array
{
    return ['socket_id' => '1234.5678', 'channel_name' => "presence-survey.{$survey->id}"];
}

it('signs presence data for a member', function () {
    $survey = TeamSurvey::factory()->open()->create();
    [$user, $respondent] = surveyMember($survey);

    $response = $this->actingAs($user)->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($response->json('auth'))->toStartWith('test-key:')
        ->and($channelData['user_id'])->toBe($respondent->id)
        ->and($channelData['user_info'])->toBe([
            'id' => $respondent->id,
            'name' => $user->name,
            'avatarUrl' => $respondent->avatarUrl(),
            'isGuest' => false,
            'presence' => $user->presenceColor(),
        ]);
});

it('signs for a guest of the survey', function () {
    $standalone = TeamSurvey::factory()->open()->withGuestAccess()->create();
    $guest = surveyGuest($standalone);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->postJson(route('broadcasting.auth'), surveyChannelRequest($standalone))
        ->assertOk();
});

it('refuses the channel of an attached health check, which speaks on its retro\'s channel', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $attached = TeamSurvey::factory()->attachedTo($retro)->open()->create();
    $retroGuest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs(teamMember($attached->team))->postJson(route('broadcasting.auth'), surveyChannelRequest($attached))->assertForbidden();
    auth()->logout();
    $this->withCookies(retroGuestCookie($retroGuest))->withCredentials()
        ->postJson(route('broadcasting.auth'), surveyChannelRequest($attached))
        ->assertForbidden();
});

it('refuses an outsider, a guest of another survey, an unauthenticated socket and a malformed name', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    $outsider = User::factory()->create();
    $survey->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);
    $otherGuest = surveyGuest(TeamSurvey::factory()->open()->withGuestAccess()->create());

    $this->actingAs($outsider)->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))->assertForbidden();
    auth()->logout();
    $this->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))->assertForbidden();
    $this->postJson(route('broadcasting.auth'), ['socket_id' => '1234.5678', 'channel_name' => 'presence-survey.not-a-uuid'])->assertForbidden();
    $this->withCookies(surveyGuestCookie($otherGuest))->withCredentials()
        ->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))
        ->assertForbidden();
});

it('refuses the channel of a draft to a member who is not an editor', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    $this->actingAs(teamMember($survey->team))->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))->assertForbidden();
    $this->actingAs($facilitator)->postJson(route('broadcasting.auth'), surveyChannelRequest($survey))->assertOk();
});
