<?php

namespace App\Actions\ActionItems;

use App\Models\Participant;
use App\Models\User;

class ActionItemActor
{
    public function __construct(public ?User $user, public ?Participant $participant) {}

    public static function forParticipant(Participant $participant): self
    {
        return new self($participant->user, $participant);
    }

    public static function forUser(User $user): self
    {
        return new self($user, null);
    }
}
