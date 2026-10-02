<?php

namespace App\Actions\Auth;

use App\Models\MagicLink;
use App\Models\User;

class ConsumeMagicLink
{
    /**
     * One conditional update claims the row: of two requests racing on the
     * same token, the database lets one change it.
     */
    public function handle(string $token): ?User
    {
        $hash = MagicLink::hashToken($token);

        $claimed = MagicLink::query()
            ->where('token_hash', $hash)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->update(['consumed_at' => now()]);

        if ($claimed !== 1) {
            return null;
        }

        return MagicLink::query()->with('user')->where('token_hash', $hash)->first()?->user;
    }
}
