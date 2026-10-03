<?php

namespace App\Http\Middleware;

use App\Enums\McpScope;
use App\Mcp\McpGrant;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateMcpRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->bearerToken() === null) {
            return $this->unauthorized();
        }

        $user = Auth::guard('sanctum')->user();

        if (! $user instanceof User) {
            return $this->unauthorized();
        }

        if ($user->isDeactivated()) {
            return $this->unauthorized();
        }

        $token = $user->currentAccessToken();

        if (! $token instanceof PersonalAccessToken) {
            return $this->unauthorized();
        }

        if ($token->isExpired(now())) {
            return $this->unauthorized();
        }

        if (! in_array(McpScope::Read, $token->scopes(), true)) {
            return $this->unauthorized();
        }

        if (! $user->hasVerifiedEmail()) {
            return $this->unauthorized();
        }

        Auth::shouldUse('sanctum');

        $request->headers->remove('X-Socket-ID');

        (new McpGrant($user, $token->id, $token->scopes(), $token->team_id))->bind();

        return $next($request);
    }

    private function unauthorized(): Response
    {
        return response()->json(
            ['error' => __('Unauthenticated.')],
            401,
            ['WWW-Authenticate' => 'Bearer realm="skrum"'],
        );
    }
}
