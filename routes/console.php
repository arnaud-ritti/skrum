<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('action-items:send-reminders')
    ->dailyAt((string) config('skrum.action_item_reminders.time'))
    ->timezone((string) config('app.timezone'))
    ->withoutOverlapping()
    ->onOneServer();

Schedule::command('sanctum:prune-expired --hours=720')
    ->daily()
    ->onOneServer();
