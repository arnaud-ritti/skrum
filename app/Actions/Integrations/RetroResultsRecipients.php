<?php

namespace App\Actions\Integrations;

use App\Enums\RetroResultsAudience;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Only current team members with a verified email ever receive results;
 * guests have no account and are never emailed (spec 6 §5.3).
 */
class RetroResultsRecipients
{
    /**
     * @return Builder<User>
     */
    public function query(Retro $retro, RetroResultsAudience $audience): Builder
    {
        return User::query()
            ->whereIn('id', $retro->team->members()->select('users.id'))
            ->whereNotNull('email_verified_at')
            ->when($audience === RetroResultsAudience::Participants, fn (Builder $query) => $query->whereIn(
                'id',
                $retro->participants()->whereNotNull('user_id')->select('user_id'),
            ));
    }

    /**
     * @return array{participants: int, team: int}
     */
    public function counts(Retro $retro): array
    {
        return [
            'participants' => $this->query($retro, RetroResultsAudience::Participants)->count(),
            'team' => $this->query($retro, RetroResultsAudience::Team)->count(),
        ];
    }

    public function isRecipient(Retro $retro, User $user): bool
    {
        return $this->query($retro, RetroResultsAudience::Team)->whereKey($user->id)->exists();
    }
}
