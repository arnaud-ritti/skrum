<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\MagicLinkRequest;
use App\Jobs\Auth\SendMagicLink;
use App\Models\MagicLink;
use App\Support\Auth\LoginAddress;
use App\Support\Auth\SignInPolicy;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class MagicLinksController extends Controller
{
    private const int CooldownSeconds = 60;

    private const int PerAddressPerHour = 5;

    /**
     * The answer is the same whatever the address: the account is looked up
     * by the job, and the per-address limits are silent.
     */
    public function store(MagicLinkRequest $request, IntegrationAvailability $availability): RedirectResponse
    {
        $address = LoginAddress::normalise($request->validated('email'));

        if ($availability->emailEnabled() && $this->claimsSendingSlot($address)) {
            dispatch(new SendMagicLink($address));
        }

        return back()->with('status', 'magic-link-sent');
    }

    /**
     * Shows who the link signs in. Nothing is consumed here: mail scanners
     * and link previews open links with GET.
     */
    public function show(Request $request, string $token, SignInPolicy $policy): Response
    {
        $link = $request->hasValidSignature() && $policy->allowsLocalCredentials() ? MagicLink::findUsable($token) : null;

        $response = Inertia::render('auth/magic-link', [
            'email' => $link === null ? null : LoginAddress::mask($link->user->email),
            'confirmUrl' => $link === null ? null : route('magicLinks.sessions.store', $token),
        ])->toResponse($request);

        $response->headers->add(['Referrer-Policy' => 'no-referrer', 'Cache-Control' => 'no-store']);

        return $response;
    }

    private function claimsSendingSlot(string $address): bool
    {
        $key = LoginAddress::throttleKey($address);

        if (RateLimiter::tooManyAttempts("magic-link-cooldown:{$key}", 1)) {
            return false;
        }

        if (RateLimiter::tooManyAttempts("magic-link-hour:{$key}", self::PerAddressPerHour)) {
            return false;
        }

        RateLimiter::hit("magic-link-cooldown:{$key}", self::CooldownSeconds);
        RateLimiter::hit("magic-link-hour:{$key}", 3600);

        return true;
    }
}
