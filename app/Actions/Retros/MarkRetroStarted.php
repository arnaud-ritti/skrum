<?php

namespace App\Actions\Retros;

use App\Models\Retro;

class MarkRetroStarted
{
    /** Sets started_at once; a later call changes nothing. */
    public function handle(Retro $retro): void
    {
        if ($retro->started_at !== null) {
            return;
        }

        $startedAt = now();

        if (Retro::query()->whereKey($retro->id)->whereNull('started_at')->update(['started_at' => $startedAt]) === 0) {
            return;
        }

        $retro->setAttribute('started_at', $startedAt)->syncOriginalAttribute('started_at');
    }
}
