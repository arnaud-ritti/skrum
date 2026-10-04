<?php

namespace App\Models;

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Support\Auth\LoginAddress;
use Database\Factories\WorkspaceInvitationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $workspace_id
 * @property string $email
 * @property WorkspaceRole $role
 * @property string $token_hash
 * @property string|null $invited_by_id
 * @property Carbon $expires_at
 * @property Carbon|null $accepted_at
 * @property string|null $team_id
 * @property TeamRole|null $team_role
 * @property string|null $message
 * @property Carbon|null $declined_at
 * @property-read Workspace $workspace
 * @property-read Team|null $team
 */
#[Fillable(['email', 'role', 'token_hash', 'invited_by_id', 'expires_at', 'accepted_at', 'team_id', 'team_role', 'message', 'declined_at'])]
class WorkspaceInvitation extends Model
{
    /** @use HasFactory<WorkspaceInvitationFactory> */
    use HasFactory;

    use HasUuids;

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findByToken(?string $token): ?self
    {
        if ($token === null || $token === '') {
            return null;
        }

        return static::query()->where('token_hash', static::hashToken($token))->first();
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return BelongsTo<User, $this> */
    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by_id');
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function isPending(): bool
    {
        if ($this->accepted_at !== null) {
            return false;
        }

        if ($this->declined_at !== null) {
            return false;
        }

        return $this->expires_at->isFuture();
    }

    public function isDeclined(): bool
    {
        return $this->declined_at !== null;
    }

    /** @return 'pending'|'expired'|'declined' */
    public function status(): string
    {
        if ($this->isDeclined()) {
            return 'declined';
        }

        if (! $this->isPending()) {
            return 'expired';
        }

        return 'pending';
    }

    public function matchesEmail(string $email): bool
    {
        return LoginAddress::normalise($this->email) === LoginAddress::normalise($email);
    }

    /**
     * Stored in the form it is looked up by, like the address of an account.
     *
     * @return Attribute<string, string>
     */
    protected function email(): Attribute
    {
        return Attribute::make(
            set: fn (string $email): string => LoginAddress::normalise($email),
        );
    }

    protected function casts(): array
    {
        return [
            'role' => WorkspaceRole::class,
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
            'team_role' => TeamRole::class,
            'declined_at' => 'datetime',
        ];
    }
}
