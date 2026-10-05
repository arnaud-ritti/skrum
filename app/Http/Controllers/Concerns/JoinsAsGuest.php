<?php

namespace App\Http\Controllers\Concerns;

use App\Actions\Retros\GuestCookie;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

trait JoinsAsGuest
{
    private function invalidLink(Request $request, string $joinPage): Response
    {
        return Inertia::render($joinPage, ['isInvalid' => true])
            ->toResponse($request)
            ->setStatusCode(404);
    }

    /**
     * A guest with a fresh secret; the cookie it returns carries the secret.
     *
     * @param  HasMany<covariant Model, covariant Model>  $guests
     * @param  array<string, mixed>  $attributes
     */
    private function createGuest(HasMany $guests, string $scope, string $scopeId, array $attributes): Cookie
    {
        $secret = Str::random(40);

        $guest = $guests->create([...$attributes, 'guest_secret_hash' => hash('sha256', $secret)]);

        return GuestCookie::make($scope, $scopeId, $guest->getKey(), $secret);
    }
}
