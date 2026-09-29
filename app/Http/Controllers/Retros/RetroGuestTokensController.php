<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Events\Retros\RetroSettingsChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RetroGuestTokensController extends Controller
{
    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);

        $guestToken = DB::transaction(function () use ($retro, $participant): string {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);

            $locked->update(['guest_token' => Str::random(40)]);

            (new RetroSettingsChanged($locked->id))->sendToOthers();

            return $locked->guest_token;
        });

        return response()->json(['guestUrl' => route('retros.join.show', $guestToken)]);
    }
}
