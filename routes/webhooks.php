<?php

use App\Http\Controllers\Integrations\InboundWebhooksController;
use App\Http\Middleware\EnsureInboundWebhooks;
use Illuminate\Support\Facades\Route;

/*
 * Provider webhooks (spec 8 §5.3): outside the web group, so no session,
 * cookie or CSRF token; every request proves itself with its URL token or
 * signature.
 */
Route::middleware(['throttle:120,1,integrationWebhooks', EnsureInboundWebhooks::class])->group(function (): void {
    Route::post('integrations/webhooks/{source}/{integration}/{token}', [InboundWebhooksController::class, 'store'])
        ->whereIn('source', ['jira', 'jira-dc'])
        ->where('token', '[A-Za-z0-9]{40}')
        ->name('integrations.webhooks.tracker.store');

    Route::post('integrations/webhooks/{source}', [InboundWebhooksController::class, 'store'])
        ->whereIn('source', ['linear', 'github'])
        ->name('integrations.webhooks.store');
});
