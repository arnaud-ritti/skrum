<?php

use App\Http\Middleware\AssignRequestId;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Monolog\Handler\TestHandler;
use Monolog\Logger;

it('puts a request id in uuid form on every response', function () {
    $response = $this->get(route('login'));

    expect($response->headers->get('X-Request-Id'))->toBeString()->toBeUuid();
});

it('gives each request its own id', function () {
    $first = $this->get(route('login'))->headers->get('X-Request-Id');
    $second = $this->get(route('login'))->headers->get('X-Request-Id');

    expect($first)->not->toBe($second);
});

it('ignores an inbound request id header', function () {
    $inbound = 'client-chosen-id';

    $response = $this->get(route('login'), ['X-Request-Id' => $inbound]);

    expect($response->headers->get('X-Request-Id'))->not->toBe($inbound)->toBeUuid();
});

it('exposes the same id in the log context during the request', function () {
    Route::get('/request-id-probe', fn () => response()->json([
        'contextId' => Context::get(AssignRequestId::ContextKey),
    ]));

    $response = $this->getJson('/request-id-probe');

    $response->assertOk();
    expect($response->json('contextId'))->toBe($response->headers->get('X-Request-Id'));
});

it('writes the request id on log entries made during the request', function () {
    $handler = new TestHandler;
    Log::extend('capture', fn () => new Logger('capture', [$handler]));
    config([
        'logging.default' => 'capture',
        'logging.channels.capture' => ['driver' => 'capture'],
    ]);
    Log::forgetChannel('capture');

    Route::get('/request-id-log-probe', function () {
        Log::info('inside the request');

        return response()->noContent();
    });

    $response = $this->get('/request-id-log-probe');

    $record = collect($handler->getRecords())->first(fn ($record) => $record->message === 'inside the request');

    expect($record)->not->toBeNull();
    expect($record->extra['request_id'] ?? $record->context['request_id'] ?? null)
        ->toBe($response->headers->get('X-Request-Id'));
});

it('keeps the body of a json error response and adds the header', function () {
    $response = $this->getJson('/api/does-not-exist');

    $response->assertNotFound();
    expect($response->json('message'))->toBeString();
    expect($response->headers->get('X-Request-Id'))->toBeUuid();
});

it('does not leak the id of one request into the next', function () {
    Route::get('/request-id-isolation-probe', fn () => response()->json([
        'contextId' => Context::get(AssignRequestId::ContextKey),
    ]));

    $first = $this->getJson('/request-id-isolation-probe');
    $second = $this->getJson('/request-id-isolation-probe');

    expect($second->json('contextId'))
        ->toBe($second->headers->get('X-Request-Id'))
        ->not->toBe($first->json('contextId'));
});
