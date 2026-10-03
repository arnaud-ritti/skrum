<?php

use App\Enums\IntegrationProvider;
use App\Enums\McpFeature;
use App\Mail\InstanceConfigurationChangedMail;
use App\Mail\InstanceTestMail;
use App\Mcp\Tools\SkrumTool;
use App\Models\WhiteboardTemplate;
use Illuminate\Contracts\Validation\ValidationRule;

arch()->preset()->php();

arch()->preset()->security();

// The configuration alert is sent synchronously, through the mailer in force before the change (spec §5.1 rule S4):
// a queued copy would run after the configuration is applied again, through the new mailer.
// The test e-mail is sent synchronously too: the admin reads its result as soon as the request ends.
arch()->preset()->laravel()->ignoring([InstanceConfigurationChangedMail::class, InstanceTestMail::class]);

arch('enums use nothing from the application, except McpFeature which asks the container whether its feature is available, and IntegrationProvider which asks the instance settings whether the admin turned it off')
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
    ->ignoring([McpFeature::class, IntegrationProvider::class]);

arch('models do not use actions, the http layer or the mcp layer, except WhiteboardTemplate which imports array shapes from two actions for static analysis')
    ->expect('App\Models')
    ->not->toUse(['App\Actions', 'App\Http', 'App\Mcp'])
    ->ignoring(WhiteboardTemplate::class);

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
