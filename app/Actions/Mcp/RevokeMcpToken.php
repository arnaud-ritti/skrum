<?php

namespace App\Actions\Mcp;

use App\Models\PersonalAccessToken;
use App\Models\User;

class RevokeMcpToken
{
    public function handle(User $user, PersonalAccessToken $token): void
    {
        abort_unless(
            $token->tokenable_type === $user->getMorphClass() && $token->tokenable_id === $user->id,
            404,
        );

        $token->delete();
    }
}
