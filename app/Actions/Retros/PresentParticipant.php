<?php

namespace App\Actions\Retros;

use App\Models\Participant;

class PresentParticipant
{
    /**
     * @return array{
     *     id: string,
     *     name: string,
     *     avatarUrl: string,
     *     isGuest: bool
     * }
     */
    public function handle(Participant $participant): array
    {
        return [
            'id' => $participant->id,
            'name' => $participant->displayName(),
            'avatarUrl' => $participant->avatarUrl(),
            'isGuest' => $participant->isGuest(),
        ];
    }
}
