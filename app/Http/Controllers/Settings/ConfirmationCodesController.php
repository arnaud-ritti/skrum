<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Controllers\Controller;
use App\Support\Auth\PasswordConfirmation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** The code an account without a known password confirms a sensitive action with. */
class ConfirmationCodesController extends Controller
{
    public function store(Request $request, SendEmailTwoFactorCode $sendCode, PasswordConfirmation $confirmation): JsonResponse
    {
        $user = $request->user();

        abort_unless($confirmation->confirmsWithCode($user), 404);

        if ($sendCode->refused($user, EmailCodePurpose::Confirm, $request->userAgent())) {
            throw ValidationException::withMessages(['email_code' => __('No code could be sent. Try again later.')]);
        }

        return response()->json([
            'sentTo' => $user->email,
            'resendIn' => $sendCode->secondsUntilResend($user, EmailCodePurpose::Confirm),
        ]);
    }
}
