<?php

namespace App\Http\Controllers;

use App\Support\Sessions\JoinCodes;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class JoinCodesController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('sessions/join-code');
    }

    /**
     * One answer for every failure, so that the page says nothing about
     * which codes exist.
     */
    public function store(Request $request, JoinCodes $joinCodes): RedirectResponse
    {
        /** @var array{code: string} $validated */
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:16'],
        ]);

        $url = $joinCodes->resolve($validated['code']);

        if ($url === null) {
            throw ValidationException::withMessages(['code' => __('No session matches this code.')]);
        }

        return redirect($url);
    }
}
