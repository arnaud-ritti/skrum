<?php

use App\Actions\Auth\ResolveSsoUser;
use App\Enums\SsoProvider;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Laravel\Socialite\Two\User as SocialiteUser;

function lowerCaseStoredAddresses(): void
{
    (require database_path('migrations/2026_10_17_100000_lower_case_user_email_addresses.php'))->up();
}

function storedAddress(User $user): string
{
    return DB::table('users')->where('id', $user->id)->value('email');
}

it('stores an address in its normalised form whoever writes it', function () {
    $user = User::factory()->create(['email' => '  Ada.Lovelace@Example.TEST ']);

    expect(storedAddress($user))->toBe('ada.lovelace@example.test');
});

it('stores the normalised address of a person registering', function () {
    config(['skrum.signup_mode' => 'open']);

    $this->post(route('register.store'), [
        'name' => 'Ada',
        'email' => 'Ada@Example.test',
        'password' => 'correct-horse-battery',
        'password_confirmation' => 'correct-horse-battery',
    ])->assertSessionHasNoErrors();

    expect(User::query()->sole()->email)->toBe('ada@example.test');
});

it('refuses a registration whose address differs from an account only by case', function () {
    config(['skrum.signup_mode' => 'open']);
    User::factory()->storedWithAddress('Bob@example.test')->create();

    $this->post(route('register.store'), [
        'name' => 'Bob',
        'email' => 'bob@example.test',
        'password' => 'correct-horse-battery',
        'password_confirmation' => 'correct-horse-battery',
    ])->assertSessionHasErrors(['email' => __('validation.unique', ['attribute' => 'email'])]);

    expect(User::query()->count())->toBe(1);
});

it('stores the normalised address on a profile update', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => 'New.Address@Example.test'])
        ->assertSessionHasNoErrors();

    expect(storedAddress($user))->toBe('new.address@example.test');
});

it('refuses a profile address that differs from another account only by case', function (string $stored, string $submitted) {
    User::factory()->storedWithAddress($stored)->create();
    $user = User::factory()->create(['email' => 'mallory@example.test']);

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => $submitted])
        ->assertSessionHasErrors(['email' => __('validation.unique', ['attribute' => 'email'])]);

    expect(storedAddress($user))->toBe('mallory@example.test');
})->with([
    'capitals submitted' => ['bob@example.test', 'Bob@Example.test'],
    'capitals stored' => ['Bob@example.test', 'bob@example.test'],
]);

it('keeps the verification when a person respells their own address', function () {
    $user = User::factory()->create(['email' => 'ada@example.test']);

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => 'Ada', 'email' => 'Ada@Example.test'])
        ->assertSessionHasNoErrors();

    expect($user->refresh()->email)->toBe('ada@example.test')
        ->and($user->email_verified_at)->not->toBeNull();
});

it('lets an account of a legacy duplicate change its name without touching its address', function () {
    User::factory()->create(['email' => 'twin@example.test']);
    $legacy = User::factory()->storedWithAddress('Twin@example.test')->create();

    $this->actingAs($legacy)
        ->patch(route('profile.update'), ['name' => 'Renamed', 'email' => 'Twin@example.test'])
        ->assertSessionHasNoErrors();

    expect($legacy->refresh()->name)->toBe('Renamed')
        ->and(storedAddress($legacy))->toBe('Twin@example.test')
        ->and($legacy->email_verified_at)->not->toBeNull();
});

it('stores the normalised address of an account created by single sign-on, which can then ask for a reset link', function () {
    config(['skrum.signup_mode' => 'open']);
    Notification::fake();

    $user = resolve(ResolveSsoUser::class)->handle(
        SsoProvider::Google,
        SocialiteUser::fake(['id' => 'g-1', 'email' => 'Bob@Example.test', 'email_verified' => true]),
        null,
    );

    expect(storedAddress($user))->toBe('bob@example.test');

    $this->post(route('password.email'), ['email' => 'Bob@Example.test']);

    Notification::assertSentToTimes($user, ResetPassword::class, 1);
});

it('lower-cases stored addresses, after which their owner gets a reset link', function () {
    Notification::fake();
    $user = User::factory()->storedWithAddress('Carol@Example.test')->create();
    $untouched = User::factory()->create(['email' => 'dave@example.test']);

    lowerCaseStoredAddresses();

    expect(storedAddress($user))->toBe('carol@example.test')
        ->and(storedAddress($untouched))->toBe('dave@example.test');

    $this->post(route('password.email'), ['email' => 'Carol@Example.test']);

    Notification::assertSentToTimes($user, ResetPassword::class, 1);
});

it('leaves every row of a colliding group as it is stored', function () {
    $lower = User::factory()->create(['email' => 'twin@example.test']);
    $capital = User::factory()->storedWithAddress('Twin@example.test')->create();
    $first = User::factory()->storedWithAddress('Eve@example.test')->create();
    $second = User::factory()->storedWithAddress('EVE@example.test')->create();

    lowerCaseStoredAddresses();

    expect(storedAddress($lower))->toBe('twin@example.test')
        ->and(storedAddress($capital))->toBe('Twin@example.test')
        ->and(storedAddress($first))->toBe('Eve@example.test')
        ->and(storedAddress($second))->toBe('EVE@example.test');
});

it('reports the groups of accounts that share an address and changes nothing', function () {
    User::factory()->create(['email' => 'twin@example.test']);
    $capital = User::factory()->storedWithAddress('Twin@example.test')->create();
    $alone = User::factory()->storedWithAddress('Alone@example.test')->create();

    $this->artisan('users:report-duplicate-emails')
        ->expectsOutputToContain('twin@example.test is shared by 2 accounts')
        ->expectsOutputToContain("{$capital->id}  Twin@example.test")
        ->doesntExpectOutputToContain($alone->id)
        ->expectsOutputToContain('1 address is shared')
        ->assertSuccessful();

    expect(storedAddress($capital))->toBe('Twin@example.test')
        ->and(storedAddress($alone))->toBe('Alone@example.test');
});

it('says so when no two accounts share an address', function () {
    User::factory()->create();

    $this->artisan('users:report-duplicate-emails')
        ->expectsOutputToContain('No duplicate')
        ->assertSuccessful();
});
