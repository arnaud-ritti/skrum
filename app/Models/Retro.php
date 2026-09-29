<?php

namespace App\Models;

use App\Enums\RetroPhase;
use App\Enums\RetroTemplate;
use Database\Factories\RetroFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string $title
 * @property RetroTemplate $template
 * @property RetroPhase $phase
 * @property string|null $facilitator_participant_id
 * @property bool $is_anonymous
 * @property int $votes_per_participant
 * @property int $votes_version
 * @property bool $guest_access_enabled
 * @property bool $reactions_enabled
 * @property bool $cursors_enabled
 * @property bool $gifs_enabled
 * @property bool $hide_vote_counts
 * @property bool $is_locked
 * @property bool $presentation_mode
 * @property bool $health_check_enabled
 * @property bool $icebreaker_enabled
 * @property string $guest_token
 * @property Carbon|null $timer_ends_at
 * @property string|null $highlighted_card_id
 * @property Carbon|null $completed_at
 * @property Carbon|null $created_at
 * @property-read Team $team
 */
#[Fillable([
    'title', 'template', 'phase', 'facilitator_participant_id', 'is_anonymous', 'votes_per_participant',
    'guest_access_enabled', 'guest_token', 'timer_ends_at', 'highlighted_card_id', 'completed_at',
    'reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode',
    'health_check_enabled', 'icebreaker_enabled',
])]
#[Hidden(['guest_token'])]
class Retro extends Model
{
    /** @use HasFactory<RetroFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return HasMany<Column, $this> */
    public function columns(): HasMany
    {
        return $this->hasMany(Column::class)->orderBy('position');
    }

    /** @return HasMany<Participant, $this> */
    public function participants(): HasMany
    {
        return $this->hasMany(Participant::class);
    }

    /** @return HasMany<Card, $this> */
    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    /** @return HasMany<CardComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(CardComment::class);
    }

    /** @return HasMany<Vote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

    /** @return HasMany<ActionItem, $this> */
    public function actionItems(): HasMany
    {
        return $this->hasMany(ActionItem::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function facilitator(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'facilitator_participant_id');
    }

    public function isFacilitator(Participant $participant): bool
    {
        return $this->facilitator_participant_id === $participant->id;
    }

    /**
     * @return array<int, RetroPhase>
     */
    public function phases(): array
    {
        return array_values(array_filter(RetroPhase::cases(), fn (RetroPhase $phase): bool => match ($phase) {
            RetroPhase::HealthCheck => (bool) $this->health_check_enabled,
            RetroPhase::Icebreaker => (bool) $this->icebreaker_enabled,
            default => true,
        }));
    }

    public function firstPhase(): RetroPhase
    {
        return $this->phases()[0];
    }

    public function nextPhase(): ?RetroPhase
    {
        return $this->neighbourPhase(1);
    }

    public function previousPhase(): ?RetroPhase
    {
        return $this->neighbourPhase(-1);
    }

    public function canMoveTo(RetroPhase $phase): bool
    {
        return $phase === $this->nextPhase() || $phase === $this->previousPhase();
    }

    private function neighbourPhase(int $offset): ?RetroPhase
    {
        $phases = $this->phases();
        $index = array_search($this->phase, $phases, true);

        if ($index === false) {
            return null;
        }

        return $phases[$index + $offset] ?? null;
    }

    protected function casts(): array
    {
        return [
            'template' => RetroTemplate::class,
            'phase' => RetroPhase::class,
            'is_anonymous' => 'boolean',
            'guest_access_enabled' => 'boolean',
            'reactions_enabled' => 'boolean',
            'cursors_enabled' => 'boolean',
            'gifs_enabled' => 'boolean',
            'hide_vote_counts' => 'boolean',
            'is_locked' => 'boolean',
            'presentation_mode' => 'boolean',
            'health_check_enabled' => 'boolean',
            'icebreaker_enabled' => 'boolean',
            'votes_per_participant' => 'integer',
            'votes_version' => 'integer',
            'timer_ends_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
}
