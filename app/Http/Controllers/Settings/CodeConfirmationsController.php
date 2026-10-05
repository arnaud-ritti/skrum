<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\VerifyEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\EmailSecondFactorRequest;
use App\Support\Auth\PasswordConfirmation;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\PasswordConfirmedResponse;
use Symfony\Component\HttpFoundation\Response;

/** Ends like Fortify's password confirmation: the same session mark, the same answer. */
class CodeConfirmationsController extends Controller
{
    public function store(EmailSecondFactorRequest $request, VerifyEmailTwoFactorCode $verify, PasswordConfirmation $confirmation): Response
    {
        $user = $request->user();

        abort_unless($confirmation->confirmsWithCode($user), 404);

        if (! $verify->handle($user, EmailCodePurpose::Confirm, $request->validated('code'))) {
            throw ValidationException::withMessages(['code' => __('The code is wrong or has expired.')]);
        }

        $request->session()->passwordConfirmed();

        return resolve(PasswordConfirmedResponse::class)->toResponse($request);
    }
}
