<?php

namespace App\Http\Controllers;

use App\Actions\Auth\CompleteLogin;
use App\Actions\Auth\ConsumeMagicLink;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class MagicLinkSessionsController extends Controller
{
    public function store(Request $request, string $token, ConsumeMagicLink $consume, CompleteLogin $completeLogin): RedirectResponse
    {
        $user = $consume->handle($token);

        if ($user === null) {
            return to_route('login')->withErrors(['email' => __('This sign-in link is no longer valid. Request a new one.')]);
        }

        return $completeLogin->handle($request, $user);
    }
}
