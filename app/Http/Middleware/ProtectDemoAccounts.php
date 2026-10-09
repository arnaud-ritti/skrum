<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ProtectDemoAccounts
{
    public function handle(Request $request, Closure $next): Response
    {
        if (config('skrum.demo.enabled') && ! $request->isMethodSafe()) {
            $user = $request->user();
            $isAvatarUpdate = $request->isMethod('PATCH') && $request->is('settings/profile')
                && $user !== null
                && $request->input('name') === $user->name
                && $request->input('email') === $user->email;

            abort_if(
                $request->is('register', 'settings', 'settings/*', 'user/*') && ! $request->is('user/confirm-password') && ! $isAvatarUpdate,
                403,
                __('Account changes are disabled in the public demo.'),
            );
        }

        return $next($request);
    }
}
