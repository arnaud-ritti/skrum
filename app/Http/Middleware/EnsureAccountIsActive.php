<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountIsActive
{
    /**
     * Signs a deactivated account out on its next web request, whichever path signed it in.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::guard('web')->user();

        if (! $user instanceof User) {
            return $next($request);
        }

        if (! $user->isDeactivated()) {
            return $next($request);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $message = __('This account is deactivated. Ask an admin of the instance.');

        abort_if($request->expectsJson() || $request->routeIs('broadcasting.auth'), 403, $message);

        return to_route('login')->withErrors(['email' => $message]);
    }
}
