<?php

namespace App\Http\Middleware;

use App\Support\InstanceSettings;
use Closure;
use Illuminate\Auth\Middleware\EnsureEmailIsVerified;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureEmailVerificationIsRequired
{
    public function __construct(private InstanceSettings $settings) {}

    public function handle(Request $request, Closure $next, ?string $redirectToRoute = null): Response
    {
        if ($request->user() !== null && ! $this->settings->requireEmailVerification()) {
            return $next($request);
        }

        return resolve(EnsureEmailIsVerified::class)->handle($request, $next, $redirectToRoute);
    }
}
