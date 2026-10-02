<?php

namespace App\Actions\Auth;

use App\Models\EmailTwoFactorCode;
use App\Models\MagicLink;
use App\Models\User;

class RevokeLoginSecrets
{
    /**
     * A link or a code issued before a credential changed must not outlive
     * the change.
     */
    public function handle(User $user, bool $turnEmailFactorOff = false): void
    {
        MagicLink::query()->where('user_id', $user->id)->delete();
        EmailTwoFactorCode::query()->where('user_id', $user->id)->delete();

        if (! $turnEmailFactorOff) {
            return;
        }

        $user->forceFill(['two_factor_email_enabled_at' => null])->save();
    }
}
