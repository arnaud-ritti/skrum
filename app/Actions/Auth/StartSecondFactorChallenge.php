<?php

namespace App\Actions\Auth;

use App\Enums\EmailCodePurpose;
use App\Enums\SecondFactorMethod;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use Illuminate\Http\Request;

class StartSecondFactorChallenge
{
    public function __construct(
        private SecondFactors $secondFactors,
        private SendEmailTwoFactorCode $sendCode,
    ) {}

    /**
     * A user whose only factor is the e-mail code gets it at once; with an
     * authenticator app too, the code is sent when they choose it.
     */
    public function handle(Request $request, User $user, bool $remember): void
    {
        $request->session()->put([
            'login.id' => $user->getKey(),
            'login.remember' => $remember,
        ]);

        if ($this->secondFactors->methodsFor($user) === [SecondFactorMethod::EmailCode]) {
            $this->sendCode->handle($user, EmailCodePurpose::Login, $request->userAgent());
        }
    }
}
