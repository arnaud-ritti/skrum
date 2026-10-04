<?php

use App\Enums\OnboardingStep;
use App\Models\Onboarding;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\Notification;

it('refuses a workspace step without a name, with a long name or with an unknown language', function (array $payload, string $field) {
    $onboarding = Onboarding::factory()->create();

    $this->actingAs($onboarding->user)
        ->put(route('onboarding.workspace.update'), $payload)
        ->assertSessionHasErrors($field);

    expect(Workspace::query()->count())->toBe(0)
        ->and($onboarding->fresh()->step)->toBe(OnboardingStep::Workspace);
})->with([
    'no name' => [['name' => '', 'locale' => 'en'], 'name'],
    'a name of 101 characters' => [['name' => str_repeat('a', 101), 'locale' => 'en'], 'name'],
    'an unknown language' => [['name' => 'Nordlys', 'locale' => 'xx'], 'locale'],
    'no language' => [['name' => 'Nordlys'], 'locale'],
]);

it('refuses a team step without a name, with a long name, an unknown colour or a long description', function (array $payload, string $field) {
    $onboarding = Onboarding::factory()->create();
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en']);

    $this->actingAs($onboarding->user)
        ->put(route('onboarding.team.update'), $payload)
        ->assertSessionHasErrors($field);

    expect($onboarding->fresh()->workspace->teams()->count())->toBe(0)
        ->and($onboarding->fresh()->step)->toBe(OnboardingStep::Team);
})->with([
    'no name' => [['name' => ''], 'name'],
    'a name of 101 characters' => [['name' => str_repeat('a', 101)], 'name'],
    'an unknown colour' => [['name' => 'Atlas', 'color' => 'teal'], 'color'],
    'a description of 201 characters' => [['name' => 'Atlas', 'description' => str_repeat('a', 201)], 'description'],
]);

it('refuses a first ritual it does not know', function () {
    $onboarding = onboardingAtInvite();
    $onboarding->update(['step' => OnboardingStep::Ritual]);

    $this->actingAs($onboarding->user)
        ->post(route('onboarding.completion.store'), ['ritual' => 'survey'])
        ->assertSessionHasErrors('ritual');

    expect($onboarding->fresh()->isCompleted())->toBeFalse();
});

it('refuses the invitations of step three before the onboarding reaches it, and sends nothing', function () {
    Notification::fake();
    $onboarding = onboardingAtInvite();
    $onboarding->update(['step' => OnboardingStep::Team]);

    $this->actingAs($onboarding->user)
        ->post(route('onboarding.invitations.store'), ['emails' => ['camille@example.com'], 'role' => 'member'])
        ->assertSessionHasErrors('emails');

    expect(WorkspaceInvitation::query()->count())->toBe(0);
    Notification::assertNothingSent();
});

it('answers 404 to every step of a completed onboarding', function (string $method, string $route, array $payload) {
    $onboarding = onboardingAtInvite();
    $onboarding->update(['completed_at' => now()]);

    $this->actingAs($onboarding->user)
        ->{$method}(route($route), $payload)
        ->assertNotFound();
})->with([
    'workspace' => ['put', 'onboarding.workspace.update', ['name' => 'Nordlys', 'locale' => 'en']],
    'team' => ['put', 'onboarding.team.update', ['name' => 'Atlas']],
    'invitations' => ['post', 'onboarding.invitations.store', ['emails' => ['camille@example.com'], 'role' => 'member']],
    'step' => ['put', 'onboarding.step.update', ['step' => 'ritual']],
    'completion' => ['post', 'onboarding.completion.store', []],
]);

it('sends a guest to sign in and an account with an unverified address to verify it before the onboarding', function () {
    $this->get(route('onboarding.show'))->assertRedirect(route('login'));
    $this->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en'])->assertRedirect(route('login'));

    $unverified = User::factory()->unverified()->create();
    Onboarding::factory()->for($unverified)->create();

    $this->actingAs($unverified)->get(route('onboarding.show'))->assertRedirect(route('verification.notice'));
    $this->actingAs($unverified)
        ->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en'])
        ->assertRedirect(route('verification.notice'));

    expect(Workspace::query()->count())->toBe(0);
});
