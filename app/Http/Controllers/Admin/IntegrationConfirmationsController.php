<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;

/** The integrations section's "Confirm": the password confirmation returns to the section only when the admin asked for it. */
class IntegrationConfirmationsController extends Controller
{
    public function create(): RedirectResponse
    {
        redirect()->setIntendedUrl(route('admin.integrations.edit'));

        return to_route('password.confirm');
    }
}
