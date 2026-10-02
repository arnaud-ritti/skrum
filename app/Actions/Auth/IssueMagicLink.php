<?php

namespace App\Actions\Auth;

use App\Models\MagicLink;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class IssueMagicLink
{
    /**
     * Returns the only copy of the plain token, inside the signed URL.
     */
    public function handle(User $user): string
    {
        $token = Str::random(64);
        $expiresAt = now()->addMinutes(MagicLink::LifetimeMinutes);

        DB::transaction(function () use ($user, $token, $expiresAt): void {
            MagicLink::query()->where('user_id', $user->id)->delete();

            MagicLink::query()->forceCreate([
                'user_id' => $user->id,
                'token_hash' => MagicLink::hashToken($token),
                'expires_at' => $expiresAt,
            ]);
        });

        return URL::temporarySignedRoute('magicLinks.show', $expiresAt, ['token' => $token]);
    }
}
