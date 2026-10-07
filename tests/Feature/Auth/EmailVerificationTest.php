<?php

use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::emailVerification());
});

function emailVerificationUrl(mixed $id, string $hash): string
{
    return URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), ['id' => $id, 'hash' => $hash]);
}

it('renders the email verification screen', function () {
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)->get(route('verification.notice'))->assertOk();
});

it('sends an unverified user to the email verification prompt', function () {
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)->get(route('appearance.edit'))->assertRedirect(route('verification.notice'));
});

it('verifies the email', function () {
    $user = User::factory()->unverified()->create();
    Event::fake();

    $response = $this->actingAs($user)->get(emailVerificationUrl($user->id, sha1($user->email)));

    Event::assertDispatched(Verified::class);
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
    $response->assertRedirect(route('dashboard', absolute: false).'?verified=1');
});

it('does not verify the email with a wrong hash', function () {
    $user = User::factory()->unverified()->create();
    Event::fake();

    $this->actingAs($user)->get(emailVerificationUrl($user->id, sha1('wrong-email')));

    Event::assertNotDispatched(Verified::class);
    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('does not verify the email with another user id', function () {
    $user = User::factory()->unverified()->create();
    Event::fake();

    $this->actingAs($user)->get(emailVerificationUrl(123, sha1($user->email)));

    Event::assertNotDispatched(Verified::class);
    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('sends a verified user from the verification prompt to the dashboard', function () {
    $user = User::factory()->create();
    Event::fake();

    $this->actingAs($user)->get(route('verification.notice'))->assertRedirect(route('dashboard', absolute: false));

    Event::assertNotDispatched(Verified::class);
});

it('sends an already verified user on without firing the event again', function () {
    $user = User::factory()->create();
    Event::fake();

    $this->actingAs($user)->get(emailVerificationUrl($user->id, sha1($user->email)))
        ->assertRedirect(route('dashboard', absolute: false).'?verified=1');

    Event::assertNotDispatched(Verified::class);
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});

it('allows unverified users when verification is disabled without marking their email verified', function () {
    config(['skrum.require_email_verification' => false]);
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)->get(route('appearance.edit'))->assertRedirect('/settings#appearance');
    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('enforces a stored requirement over the environment default', function () {
    config(['skrum.require_email_verification' => false]);
    resolve(InstanceSettings::class)->set('require_email_verification', true);
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)->get(route('appearance.edit'))->assertRedirect(route('verification.notice'));
});
