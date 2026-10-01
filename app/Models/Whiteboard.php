<?php

namespace App\Models;

use Database\Factories\WhiteboardFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property string $id
 * @property string $team_id
 * @property string $title
 * @property string|null $facilitator_member_id
 * @property bool $guest_access_enabled
 * @property string $guest_token
 * @property bool $cursors_enabled
 * @property bool $reactions_enabled
 * @property bool $locked
 * @property bool $follow_enabled
 * @property Carbon|null $timer_ends_at
 * @property int $seq
 * @property int $purged_seq
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 */
#[Fillable(['title', 'facilitator_member_id', 'guest_access_enabled', 'guest_token', 'cursors_enabled', 'reactions_enabled', 'locked', 'follow_enabled', 'timer_ends_at', 'seq', 'purged_seq'])]
#[Hidden(['guest_token'])]
class Whiteboard extends Model
{
    /** @use HasFactory<WhiteboardFactory> */
    use HasFactory;

    use HasUuids;

    public const MaxLiveElements = 5000;

    public const MaxFileKilobytes = 5120;

    public const MaxStorageBytes = 104857600;

    protected static function booted(): void
    {
        static::deleted(function (Whiteboard $board): void {
            Storage::deleteDirectory($board->storageDirectory());
        });
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return HasMany<WhiteboardMember, $this> */
    public function members(): HasMany
    {
        return $this->hasMany(WhiteboardMember::class)->orderBy('created_at')->orderBy('id');
    }

    /** @return HasMany<WhiteboardElement, $this> */
    public function elements(): HasMany
    {
        return $this->hasMany(WhiteboardElement::class);
    }

    /** @return HasMany<WhiteboardVoteSession, $this> */
    public function voteSessions(): HasMany
    {
        return $this->hasMany(WhiteboardVoteSession::class);
    }

    /** @return HasMany<WhiteboardFile, $this> */
    public function files(): HasMany
    {
        return $this->hasMany(WhiteboardFile::class);
    }

    /** @return BelongsTo<WhiteboardMember, $this> */
    public function facilitator(): BelongsTo
    {
        return $this->belongsTo(WhiteboardMember::class, 'facilitator_member_id');
    }

    public function isFacilitator(WhiteboardMember $member): bool
    {
        return $this->facilitator_member_id === $member->id;
    }

    public function storageDirectory(): string
    {
        return "whiteboards/{$this->id}";
    }

    protected function casts(): array
    {
        return [
            'guest_access_enabled' => 'boolean',
            'cursors_enabled' => 'boolean',
            'reactions_enabled' => 'boolean',
            'locked' => 'boolean',
            'follow_enabled' => 'boolean',
            'timer_ends_at' => 'datetime',
            'seq' => 'integer',
            'purged_seq' => 'integer',
        ];
    }
}
