<?php

namespace App\Actions\Auth;

use App\Enums\SsoProvider;
use App\Exceptions\SocialAccountRefused;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class LinkSocialAccount
{
    /**
     * @throws SocialAccountRefused
     */
    public function handle(User $user, SsoProvider $provider, string $providerUserId): void
    {
        throw_if($providerUserId === '', SocialAccountRefused::linkedElsewhere($provider));

        DB::transaction(function () use ($user, $provider, $providerUserId): void {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            $existing = SocialAccount::query()
                ->where('provider', $provider->value)
                ->where('provider_user_id', $providerUserId)
                ->first();

            if ($existing !== null) {
                throw_unless($existing->user_id === $locked->id, SocialAccountRefused::linkedElsewhere($provider));

                return;
            }

            throw_if($locked->socialAccounts()->where('provider', $provider->value)->exists(), SocialAccountRefused::alreadyLinked($provider));

            try {
                DB::transaction(fn () => $locked->socialAccounts()->create([
                    'provider' => $provider->value,
                    'provider_user_id' => $providerUserId,
                ]));
            } catch (UniqueConstraintViolationException) {
                throw SocialAccountRefused::linkedElsewhere($provider);
            }
        });
    }
}
