<?php

use App\Actions\Auth\LinkSocialAccount;
use App\Enums\SsoProvider;
use App\Exceptions\SocialAccountRefused;
use App\Models\SocialAccount;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('links one identity of a provider when two links of one account arrive at once', function () {
    $userId = User::factory()->create()->id;

    $outcomes = Race::run([
        static fn () => resolve(LinkSocialAccount::class)->handle(User::query()->findOrFail($userId), SsoProvider::Google, 'google-1'),
        static fn () => resolve(LinkSocialAccount::class)->handle(User::query()->findOrFail($userId), SsoProvider::Google, 'google-2'),
    ]);

    expect(collect($outcomes)->where('ok', true))->toHaveCount(1)
        ->and(collect($outcomes)->firstWhere('ok', false)['error'])->toBe(SocialAccountRefused::class)
        ->and(SocialAccount::query()->where('user_id', $userId)->count())->toBe(1);
});
