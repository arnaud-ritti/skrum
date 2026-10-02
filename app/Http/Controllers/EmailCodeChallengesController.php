<?php

namespace App\Http\Controllers;

use App\Actions\Auth\VerifyEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Requests\Auth\EmailCodeChallengeRequest;
use App\Support\Auth\SecondFactors;
use Illuminate\Support\Facades\Auth;
use Laravel\Fortify\Contracts\FailedTwoFactorLoginResponse;
use Laravel\Fortify\Contracts\TwoFactorLoginResponse;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;
use Laravel\Fortify\Events\ValidTwoFactorAuthenticationCodeProvided;
use Symfony\Component\HttpFoundation\Response;

class EmailCodeChallengesController extends Controller
{
    /**
     * Ends like Fortify's own challenge: sign in, then a new session id.
     */
    public function store(EmailCodeChallengeRequest $request, SecondFactors $secondFactors, VerifyEmailTwoFactorCode $verify): Response
    {
        $user = $request->challengedUser();

        if (! $secondFactors->hasEmailCode($user) || ! $verify->handle($user, EmailCodePurpose::Login, $request->validated('code'))) {
            event(new TwoFactorAuthenticationFailed($user));

            return resolve(FailedTwoFactorLoginResponse::class)->toResponse($request);
        }

        event(new ValidTwoFactorAuthenticationCodeProvided($user));

        $request->session()->forget(['login.id', 'login.local']);

        Auth::login($user, $request->remember());

        $request->session()->regenerate();

        return resolve(TwoFactorLoginResponse::class)->toResponse($request);
    }
}
