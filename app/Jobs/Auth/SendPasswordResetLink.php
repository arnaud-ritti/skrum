<?php

namespace App\Jobs\Auth;

use App\Models\User;
use App\Support\Auth\SignInPolicy;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use SensitiveParameter;

/**
 * Who gets the mail is decided here, away from the request, so the request
 * does the same work for every account and a mail server that fails or is
 * slow says nothing about the account. The payload holds the token: it is
 * encrypted.
 */
class SendPasswordResetLink implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(public string $userId, #[SensitiveParameter] public string $token) {}

    public function handle(SignInPolicy $policy): void
    {
        $user = User::query()->find($this->userId);

        if ($user === null) {
            return;
        }

        if (! $policy->allowsPasswordReset($user)) {
            return;
        }

        $user->notify(new ResetPassword($this->token));
    }
}
