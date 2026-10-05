<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;

/** A configuration section's "Confirm": the password confirmation returns to the section only when the admin asked for it. */
class SectionConfirmationsController extends Controller
{
    /**
     * @param  string  $sectionRoute  set by the route's defaults, never by the request
     */
    public function create(string $sectionRoute): RedirectResponse
    {
        redirect()->setIntendedUrl(route($sectionRoute));

        return to_route('password.confirm');
    }
}
