<?php

namespace App\Jobs\Auth;

use App\Actions\Auth\IssueMagicLink;
use App\Mail\MagicLinkMail;
use App\Models\MagicLink;
use App\Models\User;
use App\Support\Auth\SignInPolicy;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

/**
 * Everything that depends on whether the address has an account happens
 * here, away from the request, so the request does the same work for every
 * address. The payload holds the address only, never a token.
 */
class SendMagicLink implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(public string $email) {}

    public function handle(IssueMagicLink $issue, IntegrationAvailability $availability, SignInPolicy $policy): void
    {
        if (! $policy->allowsLocalCredentials()) {
            return;
        }

        if (! $availability->emailEnabled()) {
            return;
        }

        $users = User::query()->whereAddress($this->email)->limit(2)->get();

        if ($users->count() !== 1) {
            return;
        }

        $user = $users->sole();

        if (! $user->hasVerifiedEmail()) {
            return;
        }

        Mail::to($user)->sendNow(new MagicLinkMail($issue->handle($user), $user->email, MagicLink::LifetimeMinutes));
    }
}
