<?php

namespace App\Http\Controllers;

use App\Actions\Onboarding\PresentOnboarding;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingsController extends Controller
{
    public function show(Request $request, PresentOnboarding $presentOnboarding): Response|RedirectResponse
    {
        $user = $request->user();
        $onboarding = $user->onboarding()->first();

        if ($onboarding === null || $onboarding->isCompleted()) {
            return to_route('dashboard');
        }

        return Inertia::render('onboarding/show', $presentOnboarding->handle($onboarding, $user));
    }
}
