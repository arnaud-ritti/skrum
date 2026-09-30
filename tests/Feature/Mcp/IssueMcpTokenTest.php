<?php

use App\Actions\Mcp\IssueMcpToken;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Validation\ValidationException;

it('refuses a name the user already took after validation ran', function () {
    $user = User::factory()->create();
    PersonalAccessToken::factory()->forUser($user)->create(['name' => 'Laptop']);

    expect(fn () => app(IssueMcpToken::class)->handle($user, 'Laptop', [], null, null))
        ->toThrow(ValidationException::class, 'You already have a token with this name.');

    expect(PersonalAccessToken::query()->count())->toBe(1);
});

it('allows the same name for different users', function () {
    $user = User::factory()->create();
    PersonalAccessToken::factory()->forUser(User::factory()->create())->create(['name' => 'Laptop']);

    app(IssueMcpToken::class)->handle($user, 'Laptop', [], null, null);

    expect(PersonalAccessToken::query()->count())->toBe(2);
});
