<?php

use App\Enums\McpFeature;
use App\Mcp\Tools\SkrumTool;
use Illuminate\Contracts\Validation\ValidationRule;

arch()->preset()->php();

arch()->preset()->security();

arch()->preset()->laravel();

arch('enums use nothing from the application, except McpFeature which asks the container whether its feature is available')
    ->expect('App\Enums')
    ->not->toUse([
        'App\Actions',
        'App\Concerns',
        'App\Console',
        'App\Contracts',
        'App\Events',
        'App\Exceptions',
        'App\Http',
        'App\Jobs',
        'App\Listeners',
        'App\Mcp',
        'App\Models',
        'App\Notifications',
        'App\Policies',
        'App\Providers',
        'App\Rules',
        'App\Support',
    ])
    ->ignoring(McpFeature::class);

arch('models do not use actions, the http layer or the mcp layer')
    ->expect('App\Models')
    ->not->toUse(['App\Actions', 'App\Http', 'App\Mcp']);

arch('support classes, jobs and events do not use the http layer or the mcp layer')
    ->expect(['App\Support', 'App\Jobs', 'App\Events'])
    ->not->toUse(['App\Http', 'App\Mcp']);

arch('actions do not use the http layer')
    ->expect('App\Http')
    ->not->toBeUsedIn('App\Actions');

arch('contracts are interfaces')
    ->expect('App\Contracts')
    ->toBeInterfaces();

arch('validation rules implement ValidationRule')
    ->expect('App\Rules')
    ->classes()
    ->toImplement(ValidationRule::class);

arch('concerns are traits')
    ->expect([
        'App\Concerns',
        'App\Events\Concerns',
        'App\Http\Controllers\Concerns',
        'App\Mcp\Concerns',
    ])
    ->toBeTraits();

arch('mcp tools extend SkrumTool')
    ->expect('App\Mcp\Tools')
    ->classes()
    ->toExtend(SkrumTool::class);

arch('no class is final')
    ->expect('App')
    ->classes()
    ->not->toBeFinal();

arch('listeners are named with the Listener suffix')
    ->expect('App\Listeners')
    ->toHaveSuffix('Listener');
