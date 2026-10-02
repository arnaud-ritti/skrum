<?php

namespace App\Actions\Auth;

use App\Enums\EmailCodePurpose;
use App\Models\EmailTwoFactorCode;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use SensitiveParameter;

class VerifyEmailTwoFactorCode
{
    public function handle(User $user, EmailCodePurpose $purpose, #[SensitiveParameter] string $code): bool
    {
        return DB::transaction(function () use ($user, $purpose, $code): bool {
            $row = EmailTwoFactorCode::query()
                ->where('user_id', $user->id)
                ->where('purpose', $purpose)
                ->whereNull('consumed_at')
                ->where('expires_at', '>', now())
                ->lockForUpdate()
                ->first();

            if ($row === null) {
                return false;
            }

            if ($row->attempts >= EmailTwoFactorCode::MaxAttempts) {
                return false;
            }

            if (! hash_equals($row->code_hash, EmailTwoFactorCode::hashCode($user->id, $purpose, $code))) {
                $row->increment('attempts');

                return false;
            }

            $row->forceFill(['consumed_at' => now()])->save();

            return true;
        });
    }
}
