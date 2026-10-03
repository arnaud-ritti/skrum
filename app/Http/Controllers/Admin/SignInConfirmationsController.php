<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;

/** The sign-in section's "Confirm": the password confirmation returns to the section only when the admin asked for it. */
class SignInConfirmationsController extends Controller
{
    public function create(): RedirectResponse
    {
        redirect()->setIntendedUrl(route('admin.signIn.edit'));

        return to_route('password.confirm');
    }
}
