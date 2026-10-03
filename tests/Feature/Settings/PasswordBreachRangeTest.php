<?php

use App\Models\User;
use App\Support\Settings\SecuritySettings;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rules\Password;

beforeEach(fn () => Password::defaults(fn (): Password => Password::min(12)->uncompromised()));

it('returns the suffixes of a range that appear in breaches', function () {
    Http::fake(['api.pwnedpasswords.com/range/21BD1' => Http::response("0018A45C4D1DEF81644B54AB7F969B88D65:10\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:3")]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('passwordBreachRanges.store'), ['prefix' => '21bd1'])
        ->assertOk()
        ->assertExactJson(['suffixes' => ['0018A45C4D1DEF81644B54AB7F969B88D65', '011053FD0102E94D6AE2F8B83D76FAF94F6']]);

    Http::assertSent(fn ($request) => $request->hasHeader('Add-Padding', 'true'));
});

it('asks the range once a day', function () {
    Http::fake(['*' => Http::response('0018A45C4D1DEF81644B54AB7F969B88D65:1')]);
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])->assertOk();
    $this->actingAs($user)->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])->assertOk();

    Http::assertSentCount(1);
});

it('answers 503 and caches nothing when the range cannot be fetched', function () {
    Http::fake(['*' => Http::response('', 500)]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])
        ->assertStatus(503)
        ->assertExactJson(['available' => false]);

    expect(Cache::has('password-breach-range:21BD1'))->toBeFalse();
});

it('answers 503 when the range service cannot be reached', function () {
    Http::fake(['*' => Http::failedConnection()]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])
        ->assertStatus(503)
        ->assertExactJson(['available' => false]);
});

it('answers 404 when the rule does not check breaches', function () {
    Password::defaults(fn (): Password => Password::min(12));
    Http::fake();

    $this->actingAs(User::factory()->create())->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])->assertNotFound();

    Http::assertNothingSent();
});

it('refuses anything but five hex characters', function (string $prefix) {
    Http::fake();

    $this->actingAs(User::factory()->create())->postJson(route('passwordBreachRanges.store'), ['prefix' => $prefix])->assertJsonValidationErrors('prefix');

    Http::assertNothingSent();
})->with(['21BD', '21BD1F', 'ZZZZZ', '21BD1:']);

it('refuses a visitor', function () {
    $this->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])->assertUnauthorized();
});

it('gives the verifier the configured timeout', function () {
    config(['skrum.passwords.breach_check_timeout' => 3]);
    app()->forgetInstance(UncompromisedVerifier::class);

    $timeout = (fn (): int => $this->timeout)->call(resolve(UncompromisedVerifier::class));

    expect($timeout)->toBe(3);
});

it('tells the security section whether the live check runs', function () {
    expect(resolve(SecuritySettings::class)->offered()['liveBreachCheck'])->toBeTrue();

    Password::defaults(fn (): Password => Password::min(12));

    expect(resolve(SecuritySettings::class)->offered()['liveBreachCheck'])->toBeFalse();
});
