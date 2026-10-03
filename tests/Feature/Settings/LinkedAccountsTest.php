<?php

use App\Models\SocialAccount;
use App\Models\User;
use App\Support\InstanceSettings;
use App\Support\Settings\LinkedAccounts;
use App\Support\Settings\SecuritySettings;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia;

beforeEach(fn () => config([
    'services.google.client_id' => 'g', 'services.google.client_secret' => 's',
    'services.github.client_id' => 'h', 'services.github.client_secret' => 't',
    'mail.default' => 'array',
]));

function unlinkSocialAccountAs(mixed $test, User $user, SocialAccount $account): TestResponse
{
    return $test->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->deleteJson(route('linkedAccounts.destroy', $account));
}

it('unlinks an identity when another way in remains', function () {
    $user = User::factory()->create();
    $google = SocialAccount::factory()->for($user)->create(['provider' => 'google']);

    unlinkSocialAccountAs($this, $user, $google)->assertRedirect();

    expect($user->socialAccounts()->count())->toBe(0);
});

it('refuses to unlink the last way in', function (Closure $setUp) {
    [$user, $account] = $setUp();

    unlinkSocialAccountAs($this, $user, $account)->assertJsonValidationErrors('account');

    expect($account->fresh())->not->toBeNull();
})->with([
    'no password, mail off' => [function () {
        $user = User::factory()->create(['password_set_at' => null]);

        return [$user, SocialAccount::factory()->for($user)->create(['provider' => 'google'])];
    }],
    'a member while single sign-on is required' => [function () {
        resolve(InstanceSettings::class)->set('sso_required', true);
        $user = User::factory()->create();

        return [$user, SocialAccount::factory()->for($user)->create(['provider' => 'google'])];
    }],
]);

it('refuses an identity managed by the admin even when another remains', function () {
    resolve(InstanceSettings::class)->set('sso_required', true);
    $user = User::factory()->create();
    $google = SocialAccount::factory()->for($user)->create(['provider' => 'google']);
    SocialAccount::factory()->for($user)->create(['provider' => 'github']);

    unlinkSocialAccountAs($this, $user, $google)->assertJsonValidationErrors('account');
});

it('lets a provider turned off be unlinked', function () {
    $user = User::factory()->create();
    $entra = SocialAccount::factory()->for($user)->create(['provider' => 'entra']);

    unlinkSocialAccountAs($this, $user, $entra)->assertRedirect();

    expect($entra->fresh())->toBeNull();
});

it('unlinks with no confirmation for an account without a known password', function () {
    $user = User::factory()->create(['password_set_at' => null]);
    $google = SocialAccount::factory()->for($user)->create(['provider' => 'google']);
    SocialAccount::factory()->for($user)->create(['provider' => 'github']);

    $this->actingAs($user)->deleteJson(route('linkedAccounts.destroy', $google))->assertRedirect();

    expect($google->fresh())->toBeNull();
});

it('answers 404 for another user\'s identity and asks an account with a known password for a fresh confirmation', function () {
    $user = User::factory()->create();
    $theirs = SocialAccount::factory()->for(User::factory()->create())->create(['provider' => 'google']);
    $mine = SocialAccount::factory()->for($user)->create(['provider' => 'github']);

    unlinkSocialAccountAs($this, $user, $theirs)->assertNotFound();

    $this->flushSession();
    $this->actingAs($user)->deleteJson(route('linkedAccounts.destroy', $mine))->assertStatus(423);
});

it('describes every enabled provider and the linked ones of a provider turned off', function () {
    $user = User::factory()->create(['password_set_at' => null]);
    SocialAccount::factory()->for($user)->create(['provider' => 'google']);
    SocialAccount::factory()->for($user)->create(['provider' => 'entra']);

    $accounts = resolve(LinkedAccounts::class)->of($user);

    expect(collect($accounts['rows'])->pluck('provider')->all())->toBe(['google', 'github', 'entra'])
        ->and($accounts['rows'][0]['account']['canUnlink'])->toBeFalse()
        ->and($accounts['rows'][1]['account'])->toBeNull()
        ->and($accounts['rows'][2]['isEnabled'])->toBeFalse()
        ->and($accounts['rows'][2]['account']['canUnlink'])->toBeTrue()
        ->and($accounts['lastWayIn'])->toBeTrue();
});

it('marks an identity managed by the admin and keeps the note off when every identity may go', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'github']);

    expect(resolve(LinkedAccounts::class)->of($user)['lastWayIn'])->toBeFalse();

    resolve(InstanceSettings::class)->set('sso_required', true);

    $github = resolve(LinkedAccounts::class)->of($user)['rows'][1]['account'];

    expect($github['isManaged'])->toBeTrue()
        ->and($github['canUnlink'])->toBeFalse();
});

it('sends the linked accounts with the protected security props', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'google']);

    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('settings.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('security.protected.linkedAccounts.rows.0.provider', 'google')
            ->where('security.protected.linkedAccounts.rows.0.account.canUnlink', true)
            ->where('security.protected.linkedAccounts.lastWayIn', false));
});

it('tells the locked section whether the card exists, before any confirmation', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('settings.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('security.protected', null)
            ->where('security.canLinkAccounts', true));

    config([
        'services.google.client_id' => null,
        'services.github.client_id' => null,
        'oidc.connections.entra.client_id' => null,
        'oidc.connections.generic.client_id' => null,
    ]);

    expect(resolve(SecuritySettings::class)->offered()['canLinkAccounts'])->toBeFalse();
});
