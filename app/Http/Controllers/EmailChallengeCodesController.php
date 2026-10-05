<?php

namespace App\Http\Controllers;

use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Requests\Auth\TwoFactorChallengeRequest;
use App\Support\Auth\SecondFactors;
use Illuminate\Http\RedirectResponse;

class EmailChallengeCodesController extends Controller
{
    public function store(TwoFactorChallengeRequest $request, SecondFactors $secondFactors, SendEmailTwoFactorCode $sendCode): RedirectResponse
    {
        $user = $request->challengedUser();

        if ($secondFactors->hasEmailCode($user) && $sendCode->refused($user, EmailCodePurpose::Login, $request->userAgent())) {
            return to_route('two-factor.login')->withErrors(['email_code' => __('No code could be sent. Try again later.')]);
        }

        return to_route('two-factor.login')->with('status', 'email-code-sent');
    }
}
