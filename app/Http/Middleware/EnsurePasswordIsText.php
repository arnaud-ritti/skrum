<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fortify hands the password of a confirmation to an action typed for text:
 * anything else must be refused as a wrong answer, not end in a server error.
 */
class EnsurePasswordIsText
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->validate([
            'password' => ['required', 'string'],
        ]);

        return $next($request);
    }
}
