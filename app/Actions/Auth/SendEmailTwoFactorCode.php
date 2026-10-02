<?php

namespace App\Actions\Auth;

use App\Enums\EmailCodePurpose;
use App\Mail\TwoFactorCodeMail;
use App\Models\EmailTwoFactorCode;
use App\Models\User;
use App\Support\Auth\UserAgentSummary;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

class SendEmailTwoFactorCode
{
    public const int CooldownSeconds = 60;

    public const int HourlyCap = 5;

    public function __construct(private IntegrationAvailability $availability) {}

    /**
     * False when nothing was sent: mail does not deliver, the address is
     * not verified, the cooldown runs, or the hourly cap is reached.
     */
    public function handle(User $user, EmailCodePurpose $purpose, ?string $userAgent): bool
    {
        if (! $this->availability->emailEnabled()) {
            return false;
        }

        if (! $user->hasVerifiedEmail()) {
            return false;
        }

        if ($this->secondsUntilResend($user, $purpose) > 0) {
            return false;
        }

        $capKey = "email-code-hour:{$user->id}:{$purpose->value}";

        if (RateLimiter::tooManyAttempts($capKey, self::HourlyCap)) {
            return false;
        }

        RateLimiter::hit($capKey, 3600);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::transaction(function () use ($user, $purpose, $code): void {
            EmailTwoFactorCode::query()->where('user_id', $user->id)->where('purpose', $purpose)->delete();

            EmailTwoFactorCode::query()->forceCreate([
                'user_id' => $user->id,
                'purpose' => $purpose,
                'code_hash' => EmailTwoFactorCode::hashCode($user->id, $purpose, $code),
                'sent_at' => now(),
                'expires_at' => now()->addMinutes(EmailTwoFactorCode::LifetimeMinutes),
            ]);
        });

        Mail::to($user)->queue(new TwoFactorCodeMail($code, EmailTwoFactorCode::LifetimeMinutes, UserAgentSummary::describe($userAgent)));

        return true;
    }

    public function secondsUntilResend(User $user, EmailCodePurpose $purpose): int
    {
        $latest = EmailTwoFactorCode::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->latest('sent_at')
            ->first();

        if ($latest === null) {
            return 0;
        }

        return max(0, self::CooldownSeconds - (int) $latest->sent_at->diffInSeconds(now()));
    }
}
