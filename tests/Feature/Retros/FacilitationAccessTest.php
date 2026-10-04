<?php

use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Retro;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * Each route of the retro facilitation (plan 21), on a retro in the phase where it is taken:
 * the method, the route name, the phase, the retro's attributes, and whether it needs a topic.
 *
 * @return array<string, array{0: string, 1: string, 2: RetroPhase, 3: array<string, mixed>, 4: bool}>
 */
function facilitationRoutes(): array
{
    return [
        'pause the timer' => ['putJson', 'retros.timer.pause.update', RetroPhase::Writing, ['timer_ends_at' => now()->addMinutes(5)], false],
        'resume the timer' => ['deleteJson', 'retros.timer.pause.destroy', RetroPhase::Writing, ['timer_paused_seconds' => 120], false],
        'finish voting' => ['putJson', 'retros.votingCompletion.update', RetroPhase::Voting, [], false],
        'take finished back' => ['deleteJson', 'retros.votingCompletion.destroy', RetroPhase::Voting, [], false],
        'say I am writing' => ['putJson', 'retros.writing.update', RetroPhase::Writing, ['is_anonymous' => true], false],
        'stop writing' => ['deleteJson', 'retros.writing.destroy', RetroPhase::Writing, ['is_anonymous' => true], false],
        'mark a topic discussed' => ['putJson', 'retros.cards.discussion.update', RetroPhase::Discussing, [], true],
        'unmark a topic' => ['deleteJson', 'retros.cards.discussion.destroy', RetroPhase::Discussing, [], true],
        'save the notes of a topic' => ['putJson', 'retros.cards.notes.update', RetroPhase::Discussing, [], true],
        'reveal the ROTI' => ['putJson', 'retros.roti.reveal.update', RetroPhase::Roti, [], false],
        'nudge the last voters' => ['postJson', 'retros.roti.nudges.store', RetroPhase::Roti, [], false],
    ];
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Retro, 1: string, 2: array<string, mixed>}
 */
function facilitationRequest(string $route, RetroPhase $phase, array $attributes, bool $onTopic): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    $topicAttributes = $route === 'retros.cards.discussion.destroy' ? ['discussed_at' => now()->subMinute()] : [];
    $parameters = $onTopic ? [$retro, topicCard($retro, $topicAttributes)] : [$retro];
    $payload = $route === 'retros.cards.notes.update' ? ['body' => 'Split the pipeline', 'version' => 0] : [];

    return [$retro, route($route, $parameters), $payload];
}

dataset('facilitation routes', fn (): array => facilitationRoutes());

dataset('facilitator routes', fn (): array => array_intersect_key(facilitationRoutes(), array_flip([
    'pause the timer',
    'resume the timer',
    'mark a topic discussed',
    'unmark a topic',
    'reveal the ROTI',
    'nudge the last voters',
])));

it('refuses each facilitation route to a member of the workspace outside the team', function (string $method, string $route, RetroPhase $phase, array $attributes, bool $onTopic) {
    [$retro, $url, $payload] = facilitationRequest($route, $phase, $attributes, $onTopic);
    retroFacilitator($retro);
    $outsider = User::factory()->create();
    $retro->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->{$method}($url, $payload)->assertForbidden();

    expect($retro->participants()->where('user_id', $outsider->id)->exists())->toBeFalse();
})->with('facilitation routes');

it('refuses each facilitation route to the owner of another workspace', function (string $method, string $route, RetroPhase $phase, array $attributes, bool $onTopic) {
    [$retro, $url, $payload] = facilitationRequest($route, $phase, $attributes, $onTopic);
    retroFacilitator($retro);
    $stranger = User::factory()->create();
    Workspace::factory()->withMember($stranger, WorkspaceRole::Owner)->create();

    $this->actingAs($stranger)->{$method}($url, $payload)->assertForbidden();
})->with('facilitation routes');

it('answers each facilitation route with 401 to a logged-out visitor', function (string $method, string $route, RetroPhase $phase, array $attributes, bool $onTopic) {
    [, $url, $payload] = facilitationRequest($route, $phase, $attributes, $onTopic);

    $this->{$method}($url, $payload)->assertUnauthorized();
})->with('facilitation routes');

it('refuses each facilitation route to an observer of the team, who follows without taking part', function (string $method, string $route, RetroPhase $phase, array $attributes, bool $onTopic) {
    [$retro, $url, $payload] = facilitationRequest($route, $phase, $attributes, $onTopic);
    retroFacilitator($retro);
    $observer = teamMember($retro->team, TeamRole::Observer);

    $this->actingAs($observer)->{$method}($url, $payload)
        ->assertForbidden()
        ->assertJsonPath('message', 'Observers can follow this session but not take part.');
})->with('facilitation routes');

it('keeps the facilitator routes from a guest, who changes nothing and broadcasts nothing', function (string $method, string $route, RetroPhase $phase, array $attributes, bool $onTopic) {
    [$retro, $url, $payload] = facilitationRequest($route, $phase, $attributes, $onTopic);
    retroFacilitator($retro);
    $guest = retroGuest($retro);
    $facilitationState = fn (): array => [
        $retro->fresh()->only(['timer_ends_at', 'timer_paused_seconds', 'roti_revealed_at']),
        $retro->cards()->pluck('discussed_at', 'id')->all(),
    ];
    $stateBefore = $facilitationState();

    $this->withCookies(retroGuestCookie($guest))->withCredentials()->{$method}($url, $payload)->assertForbidden();

    expect($facilitationState())->toEqual($stateBefore)
        ->and(array_filter(array_keys(Event::dispatchedEvents()), fn (string $event): bool => str_starts_with($event, 'App\\Events\\')))->toBeEmpty();
})->with('facilitator routes');
