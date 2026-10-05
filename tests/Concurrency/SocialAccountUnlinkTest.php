<?php

use App\Actions\Auth\UnlinkSocialAccount;
use App\Exceptions\SocialAccountRefused;
use App\Models\SocialAccount;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('never removes the last way in when two unlinks arrive at once', function () {
    $user = User::factory()->unverified()->create(['password_set_at' => null]);
    $googleId = SocialAccount::factory()->for($user)->create(['provider' => 'google'])->id;
    $githubId = SocialAccount::factory()->for($user)->create(['provider' => 'github'])->id;
    $userId = $user->id;

    $outcomes = Race::run([
        static function () use ($userId, $googleId): void {
            config([
                'services.google.client_id' => 'g', 'services.google.client_secret' => 's',
                'services.github.client_id' => 'h', 'services.github.client_secret' => 't',
            ]);
            resolve(UnlinkSocialAccount::class)->handle(User::query()->findOrFail($userId), SocialAccount::query()->findOrFail($googleId));
        },
        static function () use ($userId, $githubId): void {
            config([
                'services.google.client_id' => 'g', 'services.google.client_secret' => 's',
                'services.github.client_id' => 'h', 'services.github.client_secret' => 't',
            ]);
            resolve(UnlinkSocialAccount::class)->handle(User::query()->findOrFail($userId), SocialAccount::query()->findOrFail($githubId));
        },
    ]);

    expect(collect($outcomes)->where('ok', true))->toHaveCount(1)
        ->and(collect($outcomes)->firstWhere('ok', false)['error'])->toBe(SocialAccountRefused::class)
        ->and(SocialAccount::query()->where('user_id', $userId)->count())->toBe(1);
});
