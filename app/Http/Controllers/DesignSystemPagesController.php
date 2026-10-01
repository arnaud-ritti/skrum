<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class DesignSystemPagesController extends Controller
{
    /** @var array<int, string> */
    public const array Sections = ['tokens', 'app', 'session', 'settings', 'auth', 'onboarding'];

    public function show(string $section = 'tokens'): Response
    {
        abort_unless(app()->environment(['local', 'testing']), 404);
        abort_unless(in_array($section, self::Sections, true), 404);

        return Inertia::render('dev/design-system', [
            'section' => $section,
        ]);
    }
}
