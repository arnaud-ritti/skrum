<?php

use App\Actions\Retros\GuestCookie;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the join page of an open survey with its summary', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create(['title' => 'Team pulse']);
    [$facilitator] = surveyFacilitator($survey);
    TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id, 'user_id' => workspaceManager($survey->team->workspace)->id]);

    $this->get(route('surveys.join.show', $survey->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('surveys/join')
            ->where('isInvalid', false)
            ->where('surveyTitle', 'Team pulse')
            ->where('session.title', 'Team pulse')
            ->where('session.facilitatorName', $facilitator->name)
            ->where('session.participantsCount', 1)
            ->where('session.isLive', true)
            ->where('suggestedName', fn (string $name): bool => $name !== ''));
});

it('answers 404 with the invalid state for an unknown token, a survey without guest access, a draft and an attached health check', function (Closure $token) {
    $this->get(route('surveys.join.show', $token()))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page->component('surveys/join')->where('isInvalid', true)->missing('session'));
})->with([
    'unknown' => [fn () => str_repeat('x', 40)],
    'guest access off' => [fn () => TeamSurvey::factory()->open()->create()->guest_token],
    'draft' => [fn () => TeamSurvey::factory()->withGuestAccess()->create()->guest_token],
    'attached' => [fn () => TeamSurvey::factory()->attachedTo(Retro::factory()->create())->open()->withGuestAccess()->create()->guest_token],
]);

it('lets a guest join with a name and sends them to the survey with a cookie', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();

    $response = $this->post(route('surveys.join.store', $survey->guest_token), ['name' => 'Otter'])
        ->assertRedirect(route('surveys.show', $survey));

    $guest = $survey->respondents()->whereNull('user_id')->sole();

    expect($guest->guest_name)->toBe('Otter');
    $response->assertCookie(GuestCookie::name(GuestCookie::SurveyScope, $survey->id));
});

it('sends someone already in straight to the survey', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();

    $this->actingAs(teamMember($survey->team))
        ->get(route('surveys.join.show', $survey->guest_token))
        ->assertRedirect(route('surveys.show', $survey));
});

it('refuses a join without a name or with a name that is too long', function (string $name) {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();

    $this->postJson(route('surveys.join.store', $survey->guest_token), ['name' => $name])->assertJsonValidationErrors('name');
})->with(['', str_repeat('a', 51)]);

it('lets an editor create a new link, which signs the guests out', function () {
    Event::fake([TeamSurveyChanged::class]);
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    [$facilitator] = surveyFacilitator($survey);
    [$member] = surveyMember($survey);
    $guest = surveyGuest($survey);
    $oldToken = $survey->guest_token;

    $this->actingAs($member)->postJson(route('surveys.guestToken.store', $survey))->assertForbidden();

    $url = $this->actingAs($facilitator)->postJson(route('surveys.guestToken.store', $survey))->assertOk()->json('guestUrl');

    expect($survey->fresh()->guest_token)->not->toBe($oldToken)
        ->and($url)->toBe(route('surveys.join.show', $survey->fresh()->guest_token))
        ->and($guest->fresh()->guest_secret_hash)->toBeNull();
    Event::assertDispatched(TeamSurveyChanged::class);

    auth()->logout();
    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertForbidden();
});
