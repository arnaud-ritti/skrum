<?php

namespace App\Models;

use App\Enums\ActionItemPriority;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\ActionItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string|null $retro_id
 * @property string $content
 * @property ActionItemPriority $priority
 * @property Carbon|null $due_on
 * @property Carbon|null $completed_at
 * @property string|null $assignee_user_id
 * @property string|null $assignee_participant_id
 * @property string|null $created_by_participant_id
 * @property string|null $created_by_user_id
 * @property string|null $theme_id
 * @property string|null $theme_name
 * @property string|null $recurrence
 * @property string|null $previous_occurrence_id
 * @property int|null $comments_count
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read Retro|null $retro
 * @property-read User|null $author
 * @property-read User|null $assigneeUser
 * @property-read Participant|null $assigneeParticipant
 * @property-read Participant|null $createdByParticipant
 */
#[Fillable([
    'team_id', 'retro_id', 'content', 'priority', 'due_on', 'completed_at',
    'assignee_user_id', 'assignee_participant_id', 'created_by_participant_id', 'created_by_user_id',
    'theme_id', 'theme_name', 'recurrence', 'previous_occurrence_id',
])]
class ActionItem extends Model
{
    /** @use HasFactory<ActionItemFactory> */
    use HasFactory;

    use HasUuids;

    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now((string) config('app.timezone'));
    }

    /**
     * Everything PresentActionItem reads, so lists present with a fixed
     * number of queries.
     *
     * @return array<int, string>
     */
    public static function presentationRelations(): array
    {
        return ['team.members', 'retro', 'author', 'createdByParticipant.user', 'assigneeUser', 'assigneeParticipant.user', 'subtasks'];
    }

    public function loadForPresentation(): static
    {
        $this->load(self::presentationRelations());
        $this->loadCount('comments');

        return $this;
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /** @return BelongsTo<Participant, $this> */
    public function createdByParticipant(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'created_by_participant_id');
    }

    /** @return BelongsTo<User, $this> */
    public function assigneeUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_user_id');
    }

    /** @return BelongsTo<Participant, $this> */
    public function assigneeParticipant(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'assignee_participant_id');
    }

    /** @return BelongsTo<RetroTheme, $this> */
    public function theme(): BelongsTo
    {
        return $this->belongsTo(RetroTheme::class, 'theme_id');
    }

    /** @return HasMany<ActionItemSubtask, $this> */
    public function subtasks(): HasMany
    {
        return $this->hasMany(ActionItemSubtask::class)->orderBy('position');
    }

    /** @return HasMany<ActionItemComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(ActionItemComment::class);
    }

    public function isCompleted(): bool
    {
        return $this->completed_at !== null;
    }

    public function hasRetro(): bool
    {
        return $this->retro_id !== null;
    }

    public function isOverdue(CarbonInterface $today): bool
    {
        if ($this->completed_at !== null) {
            return false;
        }

        if ($this->due_on === null) {
            return false;
        }

        return $this->due_on->toDateString() < $today->toDateString();
    }

    protected function casts(): array
    {
        return [
            'priority' => ActionItemPriority::class,
            'due_on' => 'date',
            'completed_at' => 'datetime',
        ];
    }
}
