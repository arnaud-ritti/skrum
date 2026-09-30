<?php

namespace App\Models;

use App\Enums\McpScope;
use Carbon\CarbonInterface;
use Database\Factories\PersonalAccessTokenFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

/**
 * @property string $id
 * @property string $tokenable_type
 * @property string $tokenable_id
 * @property string $name
 * @property string $token
 * @property array<int, string>|null $abilities
 * @property string|null $team_id
 * @property string $token_hint
 * @property CarbonInterface|null $last_used_at
 * @property CarbonInterface|null $expires_at
 * @property CarbonInterface|null $created_at
 * @property-read Team|null $team
 */
class PersonalAccessToken extends SanctumPersonalAccessToken
{
    /** @use HasFactory<PersonalAccessTokenFactory> */
    use HasFactory;

    use HasUuids;

    /**
     * @var array<string, string>
     */
    protected $attributes = [
        'token_hint' => '0000',
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'token',
        'abilities',
        'expires_at',
        'team_id',
        'token_hint',
    ];

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * @return array<int, McpScope>
     */
    public function scopes(): array
    {
        return array_values(array_filter(array_map(
            fn (string $ability): ?McpScope => McpScope::tryFrom($ability),
            $this->abilities ?? [],
        )));
    }

    public function isExpired(CarbonInterface $now): bool
    {
        if ($this->expires_at === null) {
            return false;
        }

        return $this->expires_at->lessThanOrEqualTo($now);
    }
}
