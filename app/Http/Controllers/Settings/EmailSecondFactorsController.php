<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\VerifyEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\EmailSecondFactorRequest;
use App\Models\EmailTwoFactorCode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class EmailSecondFactorsController extends Controller
{
    public function store(EmailSecondFactorRequest $request, VerifyEmailTwoFactorCode $verify): RedirectResponse
    {
        $user = $request->user();

        if (! $verify->handle($user, EmailCodePurpose::Enable, $request->validated('code'))) {
            throw ValidationException::withMessages(['code' => __('The code is wrong or has expired.')]);
        }

        $user->forceFill(['two_factor_email_enabled_at' => now()])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('E-mail code turned on.')]);

        return back();
    }

    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        $user->forceFill(['two_factor_email_enabled_at' => null])->save();

        EmailTwoFactorCode::query()->where('user_id', $user->id)->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('E-mail code turned off.')]);

        return back();
    }
}
