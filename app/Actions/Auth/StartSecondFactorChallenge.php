<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Http\Request;

class StartSecondFactorChallenge
{
    public function handle(Request $request, User $user, bool $remember): void
    {
        $request->session()->put([
            'login.id' => $user->getKey(),
            'login.remember' => $remember,
        ]);
    }
}
