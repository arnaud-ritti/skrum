<?php

namespace App\Http\Controllers;

use App\Enums\SsoProvider;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse;

class SsoRedirectsController extends Controller
{
    public function show(SsoProvider $provider): RedirectResponse
    {
        abort_unless($provider->isEnabled(), 404);

        return Socialite::driver($provider->driver())->redirect();
    }
}
