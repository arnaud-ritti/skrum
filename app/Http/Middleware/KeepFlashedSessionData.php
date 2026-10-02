<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class KeepFlashedSessionData
{
    /**
     * For helper requests a page sends on its own (a preview, a search, an image): data flashed for the next page,
     * such as the toast of a save, would otherwise be spent on whichever of them reaches the server first.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($request->hasSession()) {
            $request->session()->reflash();
        }

        return $response;
    }
}
