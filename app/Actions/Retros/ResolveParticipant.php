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
        if (! $retro->guest_access_enabled) {
            return null;
        }

        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name(GuestCookie::RetroScope, $retro->id)));

        if ($credentials === null) {
            return null;
        }

        [$participantId, $secret] = $credentials;

        $participant = $retro->participants()
            ->whereKey($participantId)
            ->whereNull('user_id')
            ->whereNotNull('guest_secret_hash')
            ->first();

        if ($participant === null) {
            return null;
        }

        if (! hash_equals((string) $participant->guest_secret_hash, hash('sha256', $secret))) {
            return null;
        }

        return $participant;
    }
}
