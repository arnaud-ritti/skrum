<?php

namespace App\Models;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationWebhookStatus;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Exceptions\ReadOnlyConnection;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\IntegrationErrors;
use Closure;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Credentials are read only through credential()/readableCredentials(), so
 * a key rotation without APP_PREVIOUS_KEYS turns into "Reconnect required"
 * instead of an exception.
 *
 * @property string $id
 * @property string $team_id
 * @property IntegrationProvider $provider
 * @property IntegrationStatus $status
 * @property IntegrationAccess $access
 * @property array<string, mixed> $credentials
 * @property array<string, mixed> $settings
 * @property array<int, string> $scopes
 * @property string|null $connected_by_user_id
 * @property string|null $last_error
 * @property Carbon|null $last_checked_at
 * @property IntegrationInboundMode $inbound_mode
 * @property IntegrationWebhookStatus|null $webhook_status
 * @property Carbon|null $webhook_expires_at
 * @property Carbon|null $last_inbound_at
 * @property Carbon|null $last_polled_at
 * @property Carbon|null $poll_cursor
 * @property int $consecutive_failures
 * @property Carbon|null $last_delivery_succeeded_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read User|null $connectedBy
 */
#[Fillable(['provider', 'status', 'access', 'credentials', 'settings', 'scopes', 'connected_by_user_id', 'last_error', 'last_checked_at'])]
#[Hidden(['credentials'])]
class TeamIntegration extends Model
{
    /** @use HasFactory<TeamIntegrationFactory> */
    use HasFactory;

    use HasUuids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'inbound_mode' => 'off',
        'consecutive_failures' => 0,
    ];

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<User, $this> */
    public function connectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_by_user_id');
    }

    /** @return HasMany<IntegrationUserMapping, $this> */
    public function userMappings(): HasMany
    {
        return $this->hasMany(IntegrationUserMapping::class);
    }

    public function accountFor(User $user): ?IntegrationUserMapping
    {
        return $this->userMappings()->where('user_id', $user->id)->first();
    }

    public function isActive(): bool
    {
        return $this->status === IntegrationStatus::Active;
    }

    public function canWrite(): bool
    {
        return $this->isActive() && $this->access === IntegrationAccess::Write;
    }

    public function hasScope(string $scope): bool
    {
        return in_array($scope, $this->scopes, true);
    }

    public function setting(string $key, mixed $default = null): mixed
    {
        return data_get($this->settings, $key, $default);
    }

    public function site(): ?string
    {
        $site = match ($this->provider) {
            IntegrationProvider::Jira => $this->setting('cloudId'),
            IntegrationProvider::Linear => $this->setting('organizationId'),
            IntegrationProvider::JiraDataCenter => $this->setting('serverKey'),
            IntegrationProvider::GitHub => $this->setting('installationId'),
            default => null,
        };

        return is_string($site) && $site !== '' ? $site : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function readableCredentials(): ?array
    {
        try {
            return $this->getAttributeValue('credentials');
        } catch (DecryptException) {
            $this->markReconnectRequired(__('Stored credentials could not be read. Reconnect.'));

            return null;
        }
    }

    public function credential(string $key): mixed
    {
        $credentials = $this->readableCredentials();

        if ($credentials === null) {
            throw new ReconnectRequired($this->provider, $this->last_error);
        }

        return $credentials[$key] ?? null;
    }

    public function markReconnectRequired(?string $error): void
    {
        $this->forceFill([
            'status' => IntegrationStatus::ReconnectRequired,
            'last_error' => $error === null ? null : IntegrationErrors::sanitize($error),
        ])->save();
    }

    public function markChecked(): void
    {
        $this->forceFill(['last_checked_at' => now(), 'last_error' => null])->save();
    }

    public function ensureActive(): void
    {
        if ($this->status === IntegrationStatus::ReconnectRequired) {
            throw new ReconnectRequired($this->provider, $this->last_error);
        }

        if (! $this->isActive()) {
            throw new NotConnected($this->provider);
        }
    }

    public function ensureWritable(): void
    {
        $this->ensureActive();

        if ($this->access !== IntegrationAccess::Write) {
            throw new ReadOnlyConnection($this->provider);
        }
    }

    /**
     * @template TResult
     *
     * @param  Closure(): TResult  $call
     * @return TResult
     */
    public function withReconnectHandling(Closure $call): mixed
    {
        try {
            return $call();
        } catch (ReconnectRequired $exception) {
            if ($this->exists && $this->status !== IntegrationStatus::ReconnectRequired) {
                $this->markReconnectRequired($exception->detail() ?? $exception->userMessage());
            }

            throw $exception;
        }
    }

    protected function casts(): array
    {
        return [
            'provider' => IntegrationProvider::class,
            'status' => IntegrationStatus::class,
            'access' => IntegrationAccess::class,
            'credentials' => 'encrypted:array',
            'settings' => 'array',
            'scopes' => 'array',
            'last_checked_at' => 'datetime',
            'inbound_mode' => IntegrationInboundMode::class,
            'webhook_status' => IntegrationWebhookStatus::class,
            'webhook_expires_at' => 'datetime',
            'last_inbound_at' => 'datetime',
            'last_polled_at' => 'datetime',
            'poll_cursor' => 'datetime',
            'consecutive_failures' => 'integer',
            'last_delivery_succeeded_at' => 'datetime',
        ];
    }
}
