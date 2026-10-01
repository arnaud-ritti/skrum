<?php

use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;

it('ships laravel/mcp and laravel/sanctum as production dependencies', function () {
    $composer = json_decode((string) file_get_contents(base_path('composer.json')), true);

    expect($composer['require'])->toHaveKeys(['laravel/mcp', 'laravel/sanctum'])
        ->and($composer['require-dev'] ?? [])->not->toHaveKey('laravel/mcp')
        ->and($composer['require-dev'] ?? [])->not->toHaveKey('laravel/sanctum');
});

it('refuses GET on the MCP endpoint', function () {
    $this->get('/mcp')->assertStatus(405)->assertHeader('Allow', 'POST');
});

it('prunes expired tokens daily after thirty days', function () {
    $commands = collect(resolve(Schedule::class)->events())
        ->map(fn (ScheduledEvent $event): string => (string) $event->command);

    expect($commands->contains(fn (string $command): bool => str_contains($command, 'sanctum:prune-expired --hours=720')))->toBeTrue();
});

it('documents the MCP settings', function () {
    $readme = (string) file_get_contents(base_path('README.md'));
    $env = (string) file_get_contents(base_path('.env.example'));

    foreach (['SKRUM_MCP_ENABLED', 'SKRUM_MCP_RATE_LIMIT', 'SKRUM_MCP_WRITE_RATE_LIMIT'] as $key) {
        expect($readme)->toContain($key)->and($env)->toContain($key);
    }

    expect($readme)->toContain('## Connect an AI assistant');
});
