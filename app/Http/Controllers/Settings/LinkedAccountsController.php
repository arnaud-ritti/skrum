<?php

namespace App\Http\Controllers\Settings;

use App\Enums\SsoProvider;
use App\Exceptions\SsoLoginRefused;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Auth\SsoIntent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;
use Throwable;

class LinkedAccountsController extends Controller
{
    public function create(Request $request, SsoProvider $provider): SymfonyRedirectResponse
    {
        abort_unless($provider->isEnabled(), 404);

        /** @var User $user */
        $user = $request->user();

        SsoIntent::put($request, $user, $provider);

        try {
            return $provider->socialiteDriver()->redirect();
        } catch (Throwable $exception) {
            report($exception);

            $request->session()->forget(SsoIntent::Key);

            return $this->backToSecurity($provider);
        }
    }

    private function backToSecurity(SsoProvider $provider): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'error', 'message' => SsoLoginRefused::providerFailed($provider)->getMessage()]);

        return redirect(route('settings.edit').'#security');
    }
}
