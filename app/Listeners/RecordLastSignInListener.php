<?php

namespace App\Listeners;

use App\Models\User;
use Illuminate\Auth\Events\Login;

class RecordLastSignInListener
{
    public function handle(Login $event): void
    {
        if (! $event->user instanceof User) {
            return;
        }

        User::query()->whereKey($event->user->id)->toBase()->update(['last_signed_in_at' => now()]);
    }
}
