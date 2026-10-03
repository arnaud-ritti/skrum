<?php

namespace App\Actions\Notifications;

use App\Models\User;
use App\Support\Mail\MailBrand;

class PresentActor
{
    /**
     * @return array{name: string, presence: int, avatarUrl: string}|null
     */
    public function handle(?User $user): ?array
    {
        if ($user === null) {
            return null;
        }

        return [
            'name' => $user->name,
            'presence' => MailBrand::presence($user->avatarSeed()),
            'avatarUrl' => $user->avatarUrl(),
        ];
    }
}
