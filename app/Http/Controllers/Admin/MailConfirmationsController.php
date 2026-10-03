<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;

/** The mail section's "Confirm": the password confirmation returns to the section only when the admin asked for it. */
class MailConfirmationsController extends Controller
{
    public function create(): RedirectResponse
    {
        redirect()->setIntendedUrl(route('admin.mail.show'));

        return to_route('password.confirm');
    }
}
