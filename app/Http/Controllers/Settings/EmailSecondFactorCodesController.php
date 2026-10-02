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
        $sendCode->handle($request->user(), EmailCodePurpose::Enable, $request->userAgent());

        return back()->with('status', 'email-code-sent');
    }
}
