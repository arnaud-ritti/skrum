<?php

use App\Listeners\QueueActionItemStatusPushes;
use App\Listeners\QueueWebhookEvents;

arch()->preset()->php();

arch()->preset()->security();

arch()->preset()->laravel()->ignoring([
    QueueActionItemStatusPushes::class,
    QueueWebhookEvents::class,
]);

arch('actions do not use the http layer')
    ->expect('App\Http')
    ->not->toBeUsedIn('App\Actions');
