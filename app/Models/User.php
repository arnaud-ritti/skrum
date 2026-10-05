<?php

namespace App\Models;

use App\Concerns\HasSearchColumns;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Jobs\Auth\SendPasswordResetLink;
use App\Support\Auth\LoginAddress;
use App\Support\Avatars\AvatarUrl;
use App\Support\Avatars\PresenceColor;
use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Encoder\Encoder;
use BaconQrCode\Renderer\Color\Rgb;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\Fill;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
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
 * @property Carbon|null $deactivated_at
 * @property Carbon|null $last_signed_in_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read int|string|null $total_points
 * @property-read int|null $wins
 * @property-read int|null $rounds_played
 * @property-read TeamMembership $teamMembership
 * @property-read Onboarding|null $onboarding
 */
#[Fillable(['name', 'email', 'password', 'locale', 'avatar_style', 'action_item_reminders_by_email', 'action_item_reminders_in_app', 'recap_emails', 'recap_in_app', 'single_key_shortcuts', 'presence_color', 'reduce_motion'])]
#[Hidden(['password', 'email_key', 'two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at', 'two_factor_email_enabled_at', 'remember_token', 'avatar_photo_path', 'password_set_at', 'deactivated_at', 'last_signed_in_at'])]
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
            'deactivated_at' => 'datetime',
            'last_signed_in_at' => 'datetime',
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
     * @param  Builder<static>  $query
     */
    #[Scope]
    protected function whereAddress(Builder $query, string $email): void
    {
        $query->where($query->qualifyColumn('email_key'), LoginAddress::normalise($email));
    }

    public function isDeactivated(): bool
    {
        return $this->deactivated_at !== null;
    }

    /**
     * @return array{name: string, avatarUrl: string}
     */
    public function presentAsPerson(): array
    {
        return ['name' => $this->name, 'avatarUrl' => $this->avatarUrl()];
    }

    public function avatarUrl(): string
    {
        return resolve(AvatarUrl::class)->for(
            $this->avatarSeed(),
            fn (): ?string => $this->avatar_style,
            fn (): string => $this->name,
            fn (): ?string => $this->avatar_photo_path,
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
        dispatch(new SendPasswordResetLink($this->getKey(), $token));
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

    public function isObserverOf(Team $team): bool
    {
        if ($this->canManage($team->workspace)) {
            return false;
        }

        return $team->roleOf($this) === TeamRole::Observer;
    }

    public function managesTeam(Team $team): bool
    {
        if ($this->canManage($team->workspace)) {
            return true;
        }

        return $team->roleOf($this)?->managesTeam() ?? false;
    }

    public function managesRitualsOf(Team $team): bool
    {
        if ($this->canManage($team->workspace)) {
            return true;
        }

        return $team->roleOf($this)?->managesRituals() ?? false;
    }

    /** @return BelongsToMany<Team, $this, TeamMembership, 'teamMembership'> */
    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class)
            ->using(TeamMembership::class)
            ->as('teamMembership')
            ->withPivot('role')
            ->withTimestamps();
    }

    /** @return HasOne<Onboarding, $this> */
    public function onboarding(): HasOne
    {
        return $this->hasOne(Onboarding::class);
    }

    /** @return BelongsToMany<Team, $this> */
    public function defaultFacilitatorOf(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_facilitators')->withTimestamps();
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

    /** @return HasMany<Participant, $this> */
    public function retroParticipations(): HasMany
    {
        return $this->hasMany(Participant::class);
    }

    /** @return HasMany<PokerPlayer, $this> */
    public function pokerPlayers(): HasMany
    {
        return $this->hasMany(PokerPlayer::class);
    }

    /** @return HasMany<WhiteboardMember, $this> */
    public function whiteboardMemberships(): HasMany
    {
        return $this->hasMany(WhiteboardMember::class);
    }

    /** @return HasMany<GamePlayer, $this> */
    public function gamePlayers(): HasMany
    {
        return $this->hasMany(GamePlayer::class);
    }

    /** @return HasMany<TeamSurveyRespondent, $this> */
    public function surveyRespondents(): HasMany
    {
        return $this->hasMany(TeamSurveyRespondent::class);
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

    /**
     * Fortify's QR code with the highest error correction: the security page
     * lays the logo over its middle, which the lowest one, Fortify's, would
     * not survive.
     */
    public function twoFactorQrCodeSvg(): string
    {
        $svg = new Writer(new ImageRenderer(
            new RendererStyle(192, 0, null, null, Fill::uniformColor(new Rgb(255, 255, 255), new Rgb(45, 55, 72))),
            new SvgImageBackEnd,
        ))->writeString($this->twoFactorQrCodeUrl(), Encoder::DEFAULT_BYTE_MODE_ENCODING, ErrorCorrectionLevel::H());

        return trim(substr($svg, strpos($svg, "\n") + 1));
    }
}
