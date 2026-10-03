<?php

use App\Models\AuditEvent;
use App\Models\EmailTwoFactorCode;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\IntegrationInboundEvent;
use App\Models\MagicLink;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function (): void {
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

Schedule::command('skrum:telegram-poll')
    ->everyMinute()
    ->withoutOverlapping(5)
    ->runInBackground()
    ->onOneServer();

Schedule::command('skrum:poll-integrations')
    ->everyMinute()
    ->withoutOverlapping(5)
    ->runInBackground()
    ->onOneServer();

Schedule::command('skrum:check-integrations')
    ->daily()
    ->onOneServer();

Schedule::command('model:prune', ['--model' => [AuditEvent::class, IntegrationDelivery::class, IntegrationDeliveryPayload::class, IntegrationInboundEvent::class, MagicLink::class, EmailTwoFactorCode::class]])
    ->daily()
    ->onOneServer();

Schedule::command('skrum:check-for-update')
    ->daily()
    ->onOneServer();

Schedule::command('skrum:prune-whiteboards')
    ->daily()
    ->withoutOverlapping()
    ->onOneServer();

Schedule::command('skrum:heartbeat')
    ->everyMinute()
    ->onOneServer();
