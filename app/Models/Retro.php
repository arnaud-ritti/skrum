<?php

namespace App\Models;

use App\Contracts\DeliverySubject;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Events\Retros\ResultsChanged;
use Database\Factories\RetroFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string $title
 * @property string $template
 * @property RetroPhase $phase
 * @property string|null $facilitator_participant_id
 * @property bool $is_anonymous
 * @property int|null $votes_per_participant
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
 * @property GameKind $icebreaker_game
 * @property bool $ai_summary_enabled
 * @property string|null $workspace_template_id
 * @property string|null $summary
 * @property Carbon|null $summary_generated_at
 * @property SummaryStatus|null $summary_status
 * @property Carbon|null $summary_requested_at
 * @property string $guest_token
 * @property Carbon|null $timer_ends_at
 * @property string|null $highlighted_card_id
 * @property Carbon|null $started_at
 * @property Carbon|null $completed_at
 * @property Carbon|null $created_at
 * @property-read Team $team
 * @property-read float|string|null $roti_votes_avg_score
 * @property-read int|null $roti_votes_count
 */
#[Fillable([
    'title', 'template', 'phase', 'facilitator_participant_id', 'is_anonymous', 'votes_per_participant',
    'guest_access_enabled', 'guest_token', 'timer_ends_at', 'highlighted_card_id', 'completed_at',
    'reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode', 'ai_summary_enabled',
    'health_check_enabled', 'icebreaker_enabled', 'workspace_template_id',
    'summary', 'summary_generated_at', 'summary_status', 'summary_requested_at', 'icebreaker_game',
])]
#[Hidden(['guest_token'])]
class Retro extends Model implements DeliverySubject
{
    /** @use HasFactory<RetroFactory> */
    use HasFactory;

    use HasUuids;

    protected static function booted(): void
    {
        static::deleting(function (Retro $retro): void {
            IntegrationDelivery::query()->whereMorphedTo('subject', $retro)->delete();
        });
    }

    public const SummaryPendingTimeoutMinutes = 10;

    public function voteLimit(): int
    {
        if ($this->votes_per_participant !== null) {
            return $this->votes_per_participant;
        }

        $topLevelCards = $this->relationLoaded('cards')
            ? $this->cards->whereNull('parent_card_id')->count()
            : $this->cards()->whereNull('parent_card_id')->count();

        return min(10, $topLevelCards + 3);
    }

    public function showsVoteTotals(): bool
    {
        if (in_array($this->phase, [RetroPhase::Discussing, RetroPhase::Actions, RetroPhase::Roti, RetroPhase::Completed], true)) {
            return true;
        }

        return $this->phase === RetroPhase::Voting && ! $this->hide_vote_counts;
    }

    /** @return BelongsTo<WorkspaceTemplate, $this> */
    public function workspaceTemplate(): BelongsTo
    {
        return $this->belongsTo(WorkspaceTemplate::class);
    }

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

    /** @return HasMany<Survey, $this> */
    public function surveys(): HasMany
    {
        return $this->hasMany(Survey::class)->orderBy('position');
    }

    /** @return HasMany<SurveyComment, $this> */
    public function surveyComments(): HasMany
    {
        return $this->hasMany(SurveyComment::class);
    }

    /** @return HasMany<Vote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

    public function writersCount(): int
    {
        return $this->cards()->distinct()->count('participant_id');
    }

    /** @return HasMany<RotiVote, $this> */
    public function rotiVotes(): HasMany
    {
        return $this->hasMany(RotiVote::class);
    }

    /** @return HasMany<ActionItem, $this> */
    public function actionItems(): HasMany
    {
        return $this->hasMany(ActionItem::class);
    }

    /** @return HasManyThrough<ActionItemComment, ActionItem, $this> */
    public function actionItemComments(): HasManyThrough
    {
        return $this->hasManyThrough(ActionItemComment::class, ActionItem::class);
    }

    /** @return HasManyThrough<ActionItemSubtask, ActionItem, $this> */
    public function actionItemSubtasks(): HasManyThrough
    {
        return $this->hasManyThrough(ActionItemSubtask::class, ActionItem::class);
    }

    /** @return HasMany<RetroTheme, $this> */
    public function themes(): HasMany
    {
        return $this->hasMany(RetroTheme::class)->orderBy('position');
    }

    /** @return HasMany<SuggestedAction, $this> */
    public function suggestedActions(): HasMany
    {
        return $this->hasMany(SuggestedAction::class)->orderBy('position');
    }

    /** @return HasMany<RetroHealthStatement, $this> */
    public function healthStatements(): HasMany
    {
        return $this->hasMany(RetroHealthStatement::class)->orderBy('position');
    }

    /** @return HasMany<HealthCheckAnswer, $this> */
    public function healthCheckAnswers(): HasMany
    {
        return $this->hasMany(HealthCheckAnswer::class);
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

    public function deliveryTeam(): Team
    {
        return $this->team;
    }

    public function announceDeliveryChange(): void
    {
        (new ResultsChanged($this->id))->sendToOthers();
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

    /**
     * A worker that died leaves the summary pending forever; after the
     * timeout it counts as failed so the facilitator can retry.
     */
    public function effectiveSummaryStatus(): ?SummaryStatus
    {
        if ($this->summary_status !== SummaryStatus::Pending) {
            return $this->summary_status;
        }

        if ($this->summary_requested_at === null || $this->summary_requested_at->lt(now()->subMinutes(self::SummaryPendingTimeoutMinutes))) {
            return SummaryStatus::Failed;
        }

        return SummaryStatus::Pending;
    }

    protected function casts(): array
    {
        return [
            'phase' => RetroPhase::class,
            'is_anonymous' => 'boolean',
            'guest_access_enabled' => 'boolean',
            'reactions_enabled' => 'boolean',
            'cursors_enabled' => 'boolean',
            'gifs_enabled' => 'boolean',
            'hide_vote_counts' => 'boolean',
            'is_locked' => 'boolean',
            'presentation_mode' => 'boolean',
            'ai_summary_enabled' => 'boolean',
            'health_check_enabled' => 'boolean',
            'icebreaker_enabled' => 'boolean',
            'icebreaker_game' => GameKind::class,
            'votes_per_participant' => 'integer',
            'votes_version' => 'integer',
            'timer_ends_at' => 'datetime',
            'completed_at' => 'datetime',
            'started_at' => 'datetime',
            'summary_status' => SummaryStatus::class,
            'summary_generated_at' => 'datetime',
            'summary_requested_at' => 'datetime',
        ];
    }
}
