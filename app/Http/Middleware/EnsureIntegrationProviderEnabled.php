<?php

namespace App\Http\Middleware;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Integration routes are always registered (Wayfinder, route caching) and
 * answer 404 while their provider is not configured on this instance.
 */
class EnsureIntegrationProviderEnabled
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, ?string $provider = null): Response
    {
        $resolved = $this->provider($request, $provider);

        $enabled = $resolved === null ? IntegrationProvider::anyEnabled() : $resolved->isEnabled();

        abort_unless($enabled, 404);

        return $next($request);
    }

    private function provider(Request $request, ?string $provider): ?IntegrationProvider
    {
        if ($provider !== null) {
            return IntegrationProvider::from($provider);
        }

        $parameter = $request->route('provider');

        if ($parameter instanceof IntegrationProvider) {
            return $parameter;
        }

        if (is_string($parameter)) {
            return IntegrationProvider::tryFrom($parameter) ?? abort(404);
        }

        $integration = $request->route('integration');

        return $integration instanceof TeamIntegration ? $integration->provider : null;
    }
}
