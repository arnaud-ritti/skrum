<?php

use App\Enums\WorkspaceRole;
use App\Events\TeamSurveys\TeamSurveyDeleted;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

it('lets a team member in as themselves, once', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $user = teamMember($survey->team);

    $this->actingAs($user)->get(route('surveys.show', $survey))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('surveys/show')
            ->where('snapshot.survey.id', $survey->id)
            ->where('snapshot.survey.status', 'open')
            ->where('snapshot.me.isGuest', false)
            ->where('snapshot.me.isEditor', false));

    $this->actingAs($user)->getJson(route('surveys.snapshot.show', $survey))->assertOk();

    expect($survey->respondents()->where('user_id', $user->id)->count())->toBe(1);
});

it('lets a workspace manager in as an editor', function () {
    $survey = TeamSurvey::factory()->open()->create();

    $this->actingAs(workspaceManager($survey->team->workspace))
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertOk()
        ->assertJsonPath('me.isEditor', true);
});

it('refuses a member of the workspace who is not in the team', function () {
    $survey = TeamSurvey::factory()->open()->create();
    $outsider = User::factory()->create();
    $survey->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->getJson(route('surveys.snapshot.show', $survey))->assertForbidden();
});

it('lets a guest in with a valid cookie while guest access is on, and never on a draft', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    $guest = surveyGuest($survey);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertOk()
        ->assertJsonPath('me.id', $guest->id)
        ->assertJsonPath('me.isGuest', true)
        ->assertJsonPath('survey.teamName', null)
        ->assertJsonPath('survey.guestUrl', null);

    $this->withCookies(surveyGuestCookie($guest, 'wrong'))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertForbidden();

    $survey->update(['status' => 'draft']);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertForbidden();

    $survey->update(['status' => 'open', 'guest_access_enabled' => false]);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertForbidden();
});

it('answers 401 to a visitor with neither a session nor a guest cookie', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();

    $this->getJson(route('surveys.snapshot.show', $survey))->assertUnauthorized();
});

it('sends whoever opens an attached health check to its retro, and answers 404 to its JSON routes', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $survey = TeamSurvey::factory()->attachedTo($retro)->open()->create();
    $member = teamMember($survey->team);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($member)->get(route('surveys.show', $survey))->assertRedirect(route('retros.show', $retro));
    $this->actingAs($member)->get(route('surveys.results.show', $survey))->assertRedirect(route('retros.show', $retro));
    $this->actingAs($member)->getJson(route('surveys.snapshot.show', $survey))->assertNotFound();
    $this->actingAs($member)->deleteJson(route('surveys.destroy', $survey))->assertNotFound();

    auth()->logout();
    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('surveys.snapshot.show', $survey))
        ->assertNotFound();

    expect($survey->respondents()->count())->toBe(0);
});

it('shows a draft to its editors only', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);
    $member = teamMember($survey->team);

    $this->actingAs($facilitator)->get(route('surveys.edit', $survey))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('surveys/edit')->where('snapshot.me.isEditor', true));
    $this->actingAs($member)->get(route('surveys.show', $survey))->assertForbidden();
    $this->actingAs($member)->get(route('surveys.edit', $survey))->assertForbidden();
});

it('sends an editor who opens a draft to the builder', function () {
    $survey = TeamSurvey::factory()->create();
    [$facilitator] = surveyFacilitator($survey);

    $this->actingAs($facilitator)->get(route('surveys.show', $survey))->assertRedirect(route('surveys.edit', $survey));
});

it('sends a logged-out visitor to the login page, or to the session-ended page when guests are allowed', function () {
    $closedToGuests = TeamSurvey::factory()->open()->create();
    $openToGuests = TeamSurvey::factory()->open()->withGuestAccess()->create();

    $this->get(route('surveys.show', $closedToGuests))->assertRedirect(route('login'));
    $this->get(route('surveys.show', $openToGuests))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('retros/session-ended'));
});

it('lets an editor delete the survey and tells the others', function () {
    Event::fake([TeamSurveyDeleted::class]);
    $survey = TeamSurvey::factory()->open()->create();
    [$facilitator] = surveyFacilitator($survey);
    [$member] = surveyMember($survey);

    $this->actingAs($member)->deleteJson(route('surveys.destroy', $survey))->assertForbidden();
    $this->actingAs($facilitator)->deleteJson(route('surveys.destroy', $survey))->assertNoContent();

    expect(TeamSurvey::query()->find($survey->id))->toBeNull();
    Event::assertDispatched(fn (TeamSurveyDeleted $event) => $event->surveyId === $survey->id && $event->broadcastAs() === 'survey.deleted');
});
