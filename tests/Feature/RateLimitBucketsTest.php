<?php

use App\Models\Retro;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

it('gives every numeric throttle of the application its own counter prefix', function () {
    $unprefixed = collect(Route::getRoutes()->getRoutes())
        ->filter(fn (RoutingRoute $route) => ! Str::startsWith($route->getActionName(), ['Laravel\\', 'Illuminate\\']))
        ->flatMap(fn (RoutingRoute $route) => collect($route->gatherMiddleware())
            ->filter(fn (mixed $middleware) => is_string($middleware) && preg_match('/^throttle:\d+,\d+$/', $middleware) === 1)
            ->map(fn (string $middleware) => "{$route->uri()} {$middleware}"))
        ->values()
        ->all();

    expect($unprefixed)->toBe([]);
});

it('gives each throttle prefix a single limit', function () {
    $limitsByPrefix = collect(Route::getRoutes()->getRoutes())
        ->flatMap(fn (RoutingRoute $route) => $route->gatherMiddleware())
        ->filter(fn (mixed $middleware) => is_string($middleware) && preg_match('/^throttle:\d+,\d+,.+$/', $middleware) === 1)
        ->unique()
        ->groupBy(fn (string $middleware) => Str::afterLast($middleware, ','))
        ->filter(fn ($middlewares) => $middlewares->count() > 1)
        ->all();

    expect($limitsByPrefix)->toBe([]);
});

it('keeps the guest join budget apart from the emoji data traffic of the same address', function () {
    Storage::fake();
    config(['services.emoji_data.version' => '17.0.0']);
    Storage::put('emoji-data/17.0.0/en/data.json', '[]');
    $retro = Retro::factory()->withGuestAccess()->create();

    foreach (range(1, 10) as $request) {
        $this->get(route('emoji-data.show', ['version' => '17.0.0', 'locale' => 'en', 'file' => 'data.json']))->assertOk();
    }

    $this->post(route('retros.join.store', $retro->guest_token), ['name' => 'Visitor'])
        ->assertRedirect(route('retros.show', $retro));
});
