<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailSecondFactorCodesController extends Controller
{
    public function store(Request $request, SendEmailTwoFactorCode $sendCode): RedirectResponse
    {
        if ($sendCode->refused($request->user(), EmailCodePurpose::Enable, $request->userAgent())) {
            return back()->withErrors(['email_code' => __('No code could be sent. Try again later.')]);
        }

        return back()->with('status', 'email-code-sent');
    }
}
