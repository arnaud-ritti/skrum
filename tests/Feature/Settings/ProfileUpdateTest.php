<?php

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;

test('profile page is displayed', function (): void {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('settings.edit'));

    $response->assertOk();
});

test('profile information can be updated', function (): void {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.edit'));

    $user->refresh();

    expect($user->name)->toBe('Test User')
        ->and($user->email)->toBe('test@example.com')
        ->and($user->email_verified_at)->toBeNull();
});

test('a new email address gets a verification mail', function (): void {
    Notification::fake();
    $user = User::factory()->create();

    $this
        ->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => 'new@example.com'])
        ->assertSessionHasNoErrors();

    Notification::assertSentTo($user, VerifyEmail::class);
});

test('an unchanged email address gets no verification mail', function (): void {
    Notification::fake();
    $user = User::factory()->create();

    $this
        ->actingAs($user)
        ->patch(route('profile.update'), ['name' => 'Renamed', 'email' => $user->email])
        ->assertSessionHasNoErrors();

    Notification::assertNotSentTo($user, VerifyEmail::class);
});

test('email verification status is unchanged when the email address is unchanged', function (): void {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => $user->email,
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.edit'));

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

test('user can delete their account', function (): void {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
});

test('correct password must be provided to delete account', function (): void {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('settings.edit'))
        ->delete(route('profile.destroy'), [
            'password' => 'wrong-password',
        ]);

    $response
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('settings.edit'));

    expect($user->fresh())->not->toBeNull();
});
