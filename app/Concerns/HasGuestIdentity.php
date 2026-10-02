<?php

namespace App\Concerns;

use App\Models\User;
use App\Support\Avatars\AvatarUrl;

/**
 * Identity shared by retro participants and poker players: a team member
 * (user) or a guest (display name), with a stable avatar per identity.
 *
 * @property string $id
 * @property string|null $user_id
 * @property string|null $guest_name
 * @property-read User|null $user
 */
trait HasGuestIdentity
{
    public function isGuest(): bool
    {
        return $this->guest_name !== null;
    }

    public function displayName(): string
    {
        if ($this->user !== null) {
            return $this->user->name;
        }

        return $this->guest_name ?? __('Former member');
    }

    public function avatarSeed(): string
    {
        $identity = $this->user_id ?? $this->id;

        return substr(hash_hmac('sha256', $identity, (string) config('app.key')), 0, 32);
    }

    public function avatarUrl(): string
    {
        return resolve(AvatarUrl::class)->for(
            $this->avatarSeed(),
            fn (): ?string => $this->avatarOwner()?->avatar_style,
            fn (): string => $this->displayName(),
        );
    }

    public function avatarOwner(): ?User
    {
        if ($this->user_id === null) {
            return null;
        }

        return $this->user;
    }
}
