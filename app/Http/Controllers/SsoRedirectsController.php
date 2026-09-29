<?php

namespace App\Http\Controllers;

use App\Enums\SsoProvider;
use App\Exceptions\SsoLoginRefused;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;
use Throwable;

class SsoRedirectsController extends Controller
{
    public function show(SsoProvider $provider): SymfonyRedirectResponse
    {
        abort_unless($provider->isEnabled(), 404);

        try {
            return $provider->socialiteDriver()->redirect();
        } catch (Throwable $exception) {
            report($exception);

            return $this->backToLogin($provider);
        }
    }

    private function backToLogin(SsoProvider $provider): RedirectResponse
    {
        return to_route('login')->withErrors(['email' => SsoLoginRefused::providerFailed($provider)->getMessage()]);
    }
}
