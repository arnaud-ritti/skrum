<?php

namespace App\Models;

use App\Concerns\HasSearchColumns;
use App\Enums\WorkspaceRole;
use App\Jobs\Auth\SendPasswordResetLink;
use App\Support\Auth\LoginAddress;
use App\Support\Avatars\AvatarUrl;
use App\Support\Avatars\PresenceColor;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\Events\RecoveryCodeReplaced;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;
use SensitiveParameter;

/**
 * @property string $id
 * @property string $name
 * @property string $email
 * @property string $email_key
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property Carbon|null $two_factor_email_enabled_at
 * @property string|null $remember_token
 * @property string|null $locale
 * @property bool $is_instance_admin
 * @property string|null $avatar_style
 * @property bool $action_item_reminders_by_email
 * @property bool $action_item_reminders_in_app
 * @property bool $recap_emails
 * @property bool $recap_in_app
 * @property bool $single_key_shortcuts
 * @property string|null $current_workspace_id
 * @property int|null $presence_color
 * @property string|null $avatar_photo_path
 * @property bool $reduce_motion
 * @property Carbon|null $password_set_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read int|string|null $total_points
 * @property-read int|null $wins
 * @property-read int|null $rounds_played
 */
#[Fillable(['name', 'email', 'password', 'locale', 'avatar_style', 'action_item_reminders_by_email', 'action_item_reminders_in_app', 'recap_emails', 'recap_in_app', 'single_key_shortcuts', 'presence_color', 'reduce_motion'])]
#[Hidden(['password', 'email_key', 'two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at', 'two_factor_email_enabled_at', 'remember_token', 'avatar_photo_path', 'password_set_at'])]
class User extends Authenticatable implements HasLocalePreference, MustVerifyEmail, PasskeyUser
{
    use HasApiTokens;

    /** @use HasFactory<UserFactory> */
    use HasFactory;

    use HasSearchColumns;
    use HasUuids;
    use Notifiable;
    use PasskeyAuthenticatable;
    use TwoFactorAuthenticatable;

    protected $attributes = [
        'action_item_reminders_by_email' => true,
        'action_item_reminders_in_app' => true,
        'recap_emails' => true,
        'recap_in_app' => true,
        'single_key_shortcuts' => true,
        'reduce_motion' => false,
    ];

    /** @return array<string, string> */
    public function searchColumns(): array
    {
        return ['name' => 'name_search'];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'two_factor_email_enabled_at' => 'datetime',
            'is_instance_admin' => 'boolean',
            'action_item_reminders_by_email' => 'boolean',
            'action_item_reminders_in_app' => 'boolean',
            'recap_emails' => 'boolean',
            'recap_in_app' => 'boolean',
            'single_key_shortcuts' => 'boolean',
            'presence_color' => 'integer',
            'reduce_motion' => 'boolean',
            'password_set_at' => 'datetime',
        ];
    }

    /**
     * Every writer goes through here, so an address is only ever stored in
     * the form it is looked up by, and its key is written with it.
     *
     * @return Attribute<string, string>
     */
    protected function email(): Attribute
    {
        return Attribute::make(
            set: function (string $email): array {
                $address = LoginAddress::normalise($email);

                return ['email' => $address, 'email_key' => $address];
            },
        );
    }

    /**
     * Compares the stored key, so rows from before addresses were normalised are found too,
     * and two of them sharing an address are both returned.
     *
     * @param  Builder<self>  $query
     */
    public function scopeWhereAddress(Builder $query, string $email): void
    {
        $query->where($query->qualifyColumn('email_key'), LoginAddress::normalise($email));
    }

    public function avatarUrl(): string
    {
        return resolve(AvatarUrl::class)->for(
            $this->avatarSeed(),
            fn (): ?string => $this->avatar_style,
            fn (): string => $this->name,
        );
    }

    public function avatarSeed(): string
    {
        return substr(hash_hmac('sha256', $this->id, (string) config('app.key')), 0, 32);
    }

    public function presenceColor(): int
    {
        return $this->presence_color ?? PresenceColor::forSeed($this->avatarSeed());
    }

    /**
     * The request queues the same job for every account and the job decides
     * who is mailed: the request says nothing about the setting, the account
     * or its role.
     */
    public function sendPasswordResetNotification(#[SensitiveParameter] $token): void
    {
        SendPasswordResetLink::dispatch($this->getKey(), $token);
    }

    public function preferredLocale(): ?string
    {
        return $this->locale;
    }

    /** @return BelongsToMany<Workspace, $this, WorkspaceMembership, 'membership'> */
    public function workspaces(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_user', 'user_id', 'workspace_id')
            ->using(WorkspaceMembership::class)
            ->as('membership')
            ->withPivot('role')
            ->withTimestamps();
    }

    /** @return BelongsTo<Workspace, $this> */
    public function currentWorkspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class, 'current_workspace_id');
    }

    public function roleIn(Workspace $workspace): ?WorkspaceRole
    {
        return WorkspaceMembership::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $this->id)
            ->first()
            ?->role;
    }

    public function belongsToWorkspace(Workspace $workspace): bool
    {
        return $this->roleIn($workspace) !== null;
    }

    public function canManage(Workspace $workspace): bool
    {
        return $this->roleIn($workspace)?->canManageWorkspace() ?? false;
    }

    /** @return BelongsToMany<Team, $this> */
    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class)->withTimestamps();
    }

    /** @return HasMany<GamePoint, $this> */
    public function gamePoints(): HasMany
    {
        return $this->hasMany(GamePoint::class);
    }

    /** @return HasMany<SocialAccount, $this> */
    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class);
    }

    /**
     * Fortify swaps a used recovery code for a new one, so the stock never shrinks.
     * Here the used code is removed, so the security page can say how many are left.
     *
     * @param  string  $code
     */
    public function replaceRecoveryCode($code): void
    {
        $remainingCodes = array_values(array_filter(
            $this->recoveryCodes(),
            fn (string $storedCode): bool => ! hash_equals($storedCode, $code),
        ));

        $this->forceFill([
            'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt(json_encode($remainingCodes)),
        ])->save();

        event(new RecoveryCodeReplaced($this, $code));
    }
}
