<?php

namespace App\Actions\Retros;

use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\Request;

class ResolveParticipant
{
    public function handle(Request $request, Retro $retro): ?Participant
    {
        $user = $request->user();

        if ($user !== null && $user->can('view', $retro->team)) {
            return Participant::query()->firstOrCreate([
                'retro_id' => $retro->id,
                'user_id' => $user->id,
            ]);
        }

        return $this->guest($request, $retro);
    }

    private function guest(Request $request, Retro $retro): ?Participant
    {
        return $retro->guest_access_enabled
            ? GuestCookie::findGuest($retro->participants(), $request, GuestCookie::RetroScope, $retro->id)
            : null;
    }
}
