<?php

namespace App\Actions\Auth;

use App\Exceptions\SocialAccountRefused;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SignInMethods;
use Illuminate\Support\Facades\DB;

class UnlinkSocialAccount
{
    public function __construct(private SignInMethods $methods) {}

    /**
     * The user row is locked before the ways in are counted, so two unlinks
     * at once cannot each leave the other as the last one and both pass.
     *
     * @throws SocialAccountRefused
     */
    public function handle(User $user, SocialAccount $account): void
    {
        DB::transaction(function () use ($user, $account): void {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $current = $locked->socialAccounts()->whereKey($account->id)->first();

            if ($current === null) {
                return;
            }

            throw_if($this->methods->isManagedByAdmin($current), SocialAccountRefused::managed());
            throw_if($this->methods->remaining($locked, $current) === [], SocialAccountRefused::lastWayIn());

            $current->delete();
        });
    }
}
