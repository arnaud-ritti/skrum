<?php

namespace App\Http\Middleware;

use App\Support\Integrations\Inbound\ReadInboundEvent;
use App\Support\Integrations\InboundModes;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Inbound routes exist only while the provider is enabled and this
 * instance can receive its webhooks (spec 8 §5.3); otherwise 404.
 */
class EnsureInboundWebhooks
{
    public function __construct(private InboundModes $inboundModes) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $provider = ReadInboundEvent::provider((string) $request->route('source'));

        abort_unless($this->inboundModes->acceptsWebhooks($provider), 404);

        return $next($request);
    }
}
