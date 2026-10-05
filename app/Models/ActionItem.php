<?php

namespace App\Models;

use App\Casts\DateOnly;
use App\Concerns\HasSearchColumns;
use App\Enums\ActionItemPriority;
use App\Enums\ActionItemRecurrence;
use App\Enums\ActionItemStatus;
use App\Exceptions\ModelInvariantViolation;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\ActionItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string|null $retro_id
 * @property string|null $card_id
 * @property string $content
 * @property ActionItemPriority $priority
 * @property CarbonInterface|null $due_on
 * @property Carbon|null $completed_at
 * @property string|null $completed_via_source
 * @property Carbon|null $started_at
 * @property string|null $assignee_user_id
 * @property string|null $assignee_participant_id
 * @property string|null $created_by_participant_id
 * @property string|null $created_by_user_id
 * @property string|null $theme_id
 * @property string|null $theme_name
 * @property ActionItemRecurrence|null $recurrence
 * @property string|null $previous_occurrence_id
 * @property int $sort_rank
 * @property int|null $comments_count
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read Retro|null $retro
 * @property-read User|null $author
 * @property-read User|null $assigneeUser
 * @property-read Participant|null $assigneeParticipant
 * @property-read Participant|null $createdByParticipant
 * @property-read Collection<int, ActionItemExternalLink> $externalLinks
 */
#[Fillable([
    'team_id', 'retro_id', 'content', 'priority', 'due_on', 'completed_at',
    'assignee_user_id', 'assignee_participant_id', 'created_by_participant_id', 'created_by_user_id',
    'theme_id', 'theme_name', 'recurrence', 'previous_occurrence_id', 'card_id',
])]
class ActionItem extends Model
{
    /** @use HasFactory<ActionItemFactory> */
    use HasFactory;

    use HasSearchColumns;
    use HasUuids;

    public const int CompletedSortRank = 2_000_000_000;

    private const int UndatedSortRank = 1_000_000_000;

    /**
     * The same priority the column defaults to, so a new item is ranked as it is stored.
     *
     * @var array<string, mixed>
     */
    protected $attributes = ['priority' => ActionItemPriority::Medium->value];

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
        return ['team.members', 'team.integrations', 'retro', 'author', 'createdByParticipant.user', 'assigneeUser', 'assigneeParticipant.user', 'subtasks', 'externalLinks'];
    }

    /**
     * The list's first sort key, stored (ActionItemQuery::order): open items by due date then
     * priority, undated ones after them, completed ones last. An overdue date is an earlier
     * date, so "overdue first" needs no key of its own and the rank does not depend on today.
     */
    public static function sortRankFor(bool $isCompleted, ?string $dueOn, ?ActionItemPriority $priority): int
    {
        if ($isCompleted) {
            return self::CompletedSortRank;
        }

        $weight = $priority?->sortWeight() ?? ActionItemPriority::Low->sortWeight();

        if ($dueOn === null) {
            return self::UndatedSortRank + $weight;
        }

        return (int) str_replace('-', '', substr($dueOn, 0, 10)) * 10 + $weight;
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

    /** @return BelongsTo<Card, $this> */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
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

    /** @return HasOne<ActionItem, $this> */
    public function nextOccurrence(): HasOne
    {
        return $this->hasOne(self::class, 'previous_occurrence_id');
    }

    /** @return HasMany<ActionItemComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(ActionItemComment::class);
    }

    /** @return HasMany<ActionItemExternalLink, $this> */
    public function externalLinks(): HasMany
    {
        return $this->hasMany(ActionItemExternalLink::class);
    }

    /**
     * The rank is set here and not in a `saving` listener: a faked or muted event dispatcher
     * (Event::fake, saveQuietly) would skip the listener and leave the row without its rank.
     * A stored row keeps its rank unless one of the three columns it comes from changes: a model
     * read without them knows nothing about its state. The three rules of the model are checked
     * here for the same two reasons.
     *
     * The check reads the attributes the model holds: a row read with a partial select must have
     * loaded every column of a rule before one of them is written. A query builder or mass update
     * goes through no model and is not checked.
     *
     * @param  array<string, mixed>  $options
     */
    public function save(array $options = []): bool
    {
        if (! $this->exists || $this->isDirty(['retro_id', 'assignee_user_id', 'assignee_participant_id', 'recurrence', 'due_on'])) {
            $this->refuseBrokenRule();
        }

        if (! $this->exists || $this->isDirty(['completed_at', 'due_on', 'priority'])) {
            $this->sort_rank = self::sortRankFor($this->completed_at !== null, $this->due_on?->toDateString(), $this->priority);
        }

        return parent::save($options);
    }

    private function refuseBrokenRule(): void
    {
        if ($this->assignee_user_id !== null && $this->assignee_participant_id !== null) {
            throw ModelInvariantViolation::because($this, 'an item is assigned to a member or to a guest, never both');
        }

        if ($this->retro_id === null && $this->assignee_participant_id !== null) {
            throw ModelInvariantViolation::because($this, 'a guest assignee needs a retro');
        }

        if ($this->recurrence !== null && $this->due_on === null) {
            throw ModelInvariantViolation::because($this, 'a recurrence needs a due date');
        }
    }

    public function isCompleted(): bool
    {
        return $this->completed_at !== null;
    }

    /**
     * Completion is read from `completed_at` alone; `started_at` only tells a started item
     * from one still to do.
     */
    public function currentStatus(): ActionItemStatus
    {
        if ($this->completed_at !== null) {
            return ActionItemStatus::Completed;
        }

        if ($this->started_at !== null) {
            return ActionItemStatus::Doing;
        }

        return ActionItemStatus::Open;
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

    /** @return array<string, string> */
    public function searchColumns(): array
    {
        return ['content' => 'content_search'];
    }

    protected function casts(): array
    {
        return [
            'priority' => ActionItemPriority::class,
            'recurrence' => ActionItemRecurrence::class,
            'due_on' => DateOnly::class,
            'completed_at' => 'datetime',
            'started_at' => 'datetime',
            'sort_rank' => 'integer',
        ];
    }
}
