<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingsController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        $onboarding = $request->user()->onboarding()->first();

        if ($onboarding === null || $onboarding->isCompleted()) {
            return to_route('dashboard');
        }

        return Inertia::render('onboarding/show', [
            'step' => $onboarding->step->value,
        ]);
    }
}
