<?php

namespace App\Http\Middleware\Concerns;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

trait RefusesMissingMember
{
    /**
     * Once the guest cookie is gone, an expired guest cannot be told apart
     * from a logged-out member, so a session open to guests explains both ways back.
     */
    private function refuseMissingMember(Request $request, bool $guestAccess, string $guestCookieName, string $message): Response
    {
        if ($request->user() !== null || $request->expectsJson()) {
            abort_if($request->user() === null && ! $request->cookies->has($guestCookieName), 401, __('Your session has expired.'));

            abort(403, $message);
        }

        if (! $guestAccess) {
            return redirect()->guest(route('login'));
        }

        redirect()->setIntendedUrl($request->fullUrl());

        return Inertia::render('retros/session-ended')->toResponse($request);
    }
}
