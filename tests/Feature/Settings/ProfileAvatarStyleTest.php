<?php

use App\Enums\InstanceSettingKey;
use App\Models\User;
use App\Support\InstanceSettings;
use Inertia\Testing\AssertableInertia;

function allowMemberAvatarStyles(bool $allowed = true): void
{
    resolve(InstanceSettings::class)->set(InstanceSettingKey::AvatarMemberChoice->value, $allowed);
}

it('stores the avatar style of a member when members may choose', function () {
    allowMemberAvatarStyles();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => $user->email, 'avatar_style' => 'micah'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    expect($user->fresh()->avatar_style)->toBe('micah')
        ->and($user->fresh()->email_verified_at)->not->toBeNull();
});

it('returns a member to the instance style', function () {
    allowMemberAvatarStyles();
    $user = User::factory()->create(['avatar_style' => 'micah']);

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => $user->email, 'avatar_style' => null])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->avatar_style)->toBeNull();
});

it('keeps the avatar style when the profile form does not send it', function () {
    allowMemberAvatarStyles();
    $user = User::factory()->create(['avatar_style' => 'micah']);

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => 'Renamed', 'email' => $user->email])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->avatar_style)->toBe('micah');
});

it('refuses an avatar style that cannot be selected', function (mixed $style) {
    allowMemberAvatarStyles();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => $user->email, 'avatar_style' => $style])
        ->assertSessionHasErrors('avatar_style');

    expect($user->fresh()->avatar_style)->toBeNull();
})->with([
    'unknown' => ['no-such-style'],
    'path' => ['../../composer'],
    'without licence data' => ['blobs'],
    'array' => [['micah']],
]);

it('ignores the avatar style when members may not choose', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => 'Renamed', 'email' => $user->email, 'avatar_style' => 'micah'])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->avatar_style)->toBeNull()
        ->and($user->fresh()->name)->toBe('Renamed');
});

it('keeps a stored member style without using it once the choice is turned off', function () {
    allowMemberAvatarStyles();
    $user = User::factory()->create(['avatar_style' => 'micah']);

    allowMemberAvatarStyles(false);

    expect($user->fresh()->avatarUrl())->toBe("/avatars/{$user->avatarSeed()}.svg")
        ->and($user->fresh()->avatar_style)->toBe('micah');

    allowMemberAvatarStyles();

    expect($user->fresh()->avatarUrl())->toBe("/avatars/micah/{$user->avatarSeed()}.svg");
});

it('lists the selectable styles on the profile page when members may choose', function () {
    config(['skrum.avatar_style' => 'thumbs']);
    allowMemberAvatarStyles();
    $user = User::factory()->create(['name' => 'Ada Lovelace', 'avatar_style' => 'micah']);
    $seed = $user->avatarSeed();

    $this->actingAs($user)->get(route('profile.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/profile')
            ->where('avatarMemberChoice', true)
            ->where('avatarStyle', 'micah')
            ->where('instanceAvatarStyle', 'thumbs')
            ->where('avatarStyles', fn ($styles) => collect($styles)->firstWhere('value', 'micah') == [
                'value' => 'micah',
                'name' => 'Micah',
                'license' => 'CC BY 4.0',
                'attribution' => 'Avatar Illustration System by Micah Lanier, CC BY 4.0',
                'attributionRequired' => true,
                'sampleUrls' => ["/avatars/micah/{$seed}.svg"],
            ]
                && collect($styles)->firstWhere('value', 'thumbs')['sampleUrls'] === ["/avatars/{$seed}.svg"]
                && collect($styles)->firstWhere('value', 'initials')['sampleUrls'] === ["/avatars/initials/{$seed}.svg?n=AL"]
                && collect($styles)->firstWhere('value', 'blobs') === null));
});

it('sends no style list to the profile page when members may not choose', function () {
    $user = User::factory()->create(['avatar_style' => 'micah']);

    $this->actingAs($user)->get(route('profile.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('avatarMemberChoice', false)
            ->where('avatarStyle', null)
            ->where('avatarStyles', []));
});

it('refuses to delete the account of the last instance admin', function (string $locale, string $message) {
    $admin = User::factory()->instanceAdmin()->create(['locale' => $locale]);
    User::factory()->create();

    $this->actingAs($admin)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertRedirect(route('profile.edit'))
        ->assertSessionHasErrors(['password' => $message]);

    $this->assertAuthenticatedAs($admin);

    expect($admin->fresh())->not->toBeNull()
        ->and($admin->fresh()->is_instance_admin)->toBeTrue();
})->with([
    'en' => ['en', 'Name another instance admin before deleting your account.'],
    'fr' => ['fr', 'Nomme un autre administrateur de l’instance avant de supprimer ton compte.'],
    'es' => ['es', 'Nombra a otro administrador de la instancia antes de eliminar tu cuenta.'],
    'de' => ['de', 'Ernenne einen weiteren Instanz-Administrator, bevor du dein Konto löschst.'],
]);

it('lets an instance admin delete their account when another admin remains', function () {
    $admin = User::factory()->instanceAdmin()->create();
    $other = User::factory()->instanceAdmin()->create();

    $this->actingAs($admin)
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();

    expect($admin->fresh())->toBeNull()
        ->and($other->fresh()->is_instance_admin)->toBeTrue();
});

it('asks for the password before the last-admin rule', function () {
    $admin = User::factory()->instanceAdmin()->create();

    $this->actingAs($admin)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), ['password' => 'wrong-password'])
        ->assertSessionHasErrors('password');

    expect($admin->fresh())->not->toBeNull();
});
