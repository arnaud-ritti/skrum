<?php

namespace App\Http\Controllers;

class InviteLinksController extends Controller
{
    public function show(string $token): never
    {
        abort(404);
    }
}
