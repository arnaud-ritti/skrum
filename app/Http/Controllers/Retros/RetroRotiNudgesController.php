<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\RotiNudged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\RateLimiter;

/**
 * "Nudge the last n": nothing is stored, each board decides whether its viewer is one of them.
 */
class RetroRotiNudgesController extends Controller
{
    public function store(Request $request, Retro $retro): Response
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::Roti);
        RetroGuard::takesRotiVotes($retro);

        $key = "roti-nudge:{$retro->id}";

        abort_if(RateLimiter::tooManyAttempts($key, 1), 429, __('You can nudge again in a moment.'));

        RateLimiter::hit($key, Retro::NudgeIntervalSeconds);

        (new RotiNudged($retro->id))->sendToOthers();

        return response()->noContent();
    }
}
