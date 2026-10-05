<?php

use App\Actions\Auth\IssueMagicLink;
use App\Models\MagicLink;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\InstanceSettings;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config([
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'services.github.client_id' => null,
        'services.github.client_secret' => null,
    ]);
});

it('shows the setting, the providers and what stands in the way', function () {
    $admin = actingAsConfirmedAdmin($this);
    User::factory()->count(2)->create();
    SocialAccount::factory()->for(User::factory())->create();

    $this->get(route('admin.signIn.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/sign-in')
            ->where('ssoRequired', false)
            ->where('inForce', false)
            ->where('providers', [['key' => 'google', 'label' => 'Google']])
            ->where('blockers', ['no_identity', 'no_second_factor'])
            ->where('accountsWithoutSso', 3));

    SocialAccount::factory()->for($admin)->create(['provider' => 'google']);

    $this->get(route('admin.signIn.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('blockers', ['no_second_factor'])
        ->where('accountsWithoutSso', 2));
});

it('counts the admins who can use the password way back', function () {
    actingAsConfirmedAdmin($this);
    User::factory()->instanceAdmin()->withTwoFactor()->create();
    User::factory()->withTwoFactor()->create();

    $this->get(route('admin.signIn.edit'))->assertInertia(fn (Assert $page) => $page->where('adminsWithPasswordWayBack', 1));
});

it('leaves deactivated accounts out of both counts', function () {
    actingAsConfirmedAdmin($this);
    User::factory()->instanceAdmin()->withTwoFactor()->deactivated()->create();
    User::factory()->deactivated()->create();

    $this->get(route('admin.signIn.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('accountsWithoutSso', 1)
        ->where('adminsWithPasswordWayBack', 0));
});

it('refuses to turn it on when the acting admin has no second factor', function () {
    $admin = actingAsConfirmedAdmin($this);
    SocialAccount::factory()->for($admin)->create(['provider' => 'google']);

    $this->put(route('admin.signIn.update'), ['sso_required' => true])->assertSessionHasErrors('sso_required');

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeFalse();
});

it('says when the stored setting is not in force', function () {
    actingAsConfirmedAdmin($this);
    resolve(InstanceSettings::class)->set('sso_required', true);
    config(['services.google.client_id' => null]);

    $this->get(route('admin.signIn.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('ssoRequired', true)
        ->where('inForce', false)
        ->where('blockers', ['no_provider']));
});

it('refuses to turn it on when no provider is configured', function () {
    $admin = actingAsConfirmedAdmin($this, factory: User::factory()->withTwoFactor());
    SocialAccount::factory()->for($admin)->create(['provider' => 'google']);
    config(['services.google.client_id' => null]);

    $this->put(route('admin.signIn.update'), ['sso_required' => true])->assertSessionHasErrors('sso_required');

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeFalse();
});

it('refuses to turn it on when the acting admin has no SSO identity of an enabled provider', function (?string $provider) {
    $admin = actingAsConfirmedAdmin($this, factory: User::factory()->withTwoFactor());

    if ($provider !== null) {
        SocialAccount::factory()->for($admin)->create(['provider' => $provider]);
    }

    $this->put(route('admin.signIn.update'), ['sso_required' => true])->assertSessionHasErrors('sso_required');

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeFalse();
})->with(['no identity' => null, 'identity of a provider that is not enabled' => 'github']);

it('turns it on and deletes the outstanding magic links', function () {
    $admin = actingAsConfirmedAdmin($this, factory: User::factory()->withTwoFactor());
    SocialAccount::factory()->for($admin)->create(['provider' => 'google']);
    resolve(IssueMagicLink::class)->handle(User::factory()->create());

    $this->put(route('admin.signIn.update'), ['sso_required' => true])
        ->assertRedirect(route('admin.signIn.edit'))
        ->assertSessionHasNoErrors();

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeTrue()
        ->and(MagicLink::query()->count())->toBe(0);
});

it('turns it off whatever the state of the providers and of the admin', function () {
    actingAsConfirmedAdmin($this);
    resolve(InstanceSettings::class)->set('sso_required', true);
    config(['services.google.client_id' => null]);

    $this->put(route('admin.signIn.update'), ['sso_required' => false])->assertSessionHasNoErrors();

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeFalse();
});

it('keeps the setting when branding is reset', function () {
    actingAsConfirmedAdmin($this);
    resolve(InstanceSettings::class)->setMany(['sso_required' => true, 'brand_color' => '#2b63b0']);

    $this->delete(route('admin.branding.destroy'))->assertRedirect(route('admin.branding.edit'));

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeTrue()
        ->and(resolve(InstanceSettings::class)->brandColor())->toBeNull();
});

it('refuses a value that is not a boolean', function (mixed $value) {
    actingAsConfirmedAdmin($this);

    $this->put(route('admin.signIn.update'), ['sso_required' => $value])->assertSessionHasErrors('sso_required');
})->with(['maybe', null, [[true]]]);

it('keeps the page away from members and behind password confirmation', function () {
    $this->actingAs(User::factory()->create())->get(route('admin.signIn.edit'))->assertForbidden();
    $this->actingAs(User::factory()->create())->put(route('admin.signIn.update'), ['sso_required' => true])->assertForbidden();

    $this->actingAs(User::factory()->instanceAdmin()->create())
        ->get(route('admin.signIn.edit'))
        ->assertRedirect(route('password.confirm'));

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeFalse();
});
