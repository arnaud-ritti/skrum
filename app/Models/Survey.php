<?php

namespace App\Models;

use App\Enums\SurveyKind;
use Database\Factories\SurveyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection as SupportCollection;

/**
 * @property string $id
 * @property string $retro_id
 * @property string|null $created_by_participant_id
 * @property SurveyKind $kind
 * @property string $question
 * @property string|null $description
 * @property int $position
 * @property bool $is_closed
 * @property bool $show_voters
 * @property int $version
 * @property-read Retro $retro
 * @property-read Collection<int, SurveyOption> $options
 * @property-read Collection<int, SurveyResponse> $responses
 * @property-read Collection<int, SurveyTextAnswer> $textAnswers
 * @property-read Collection<int, SurveyReaction> $reactions
 * @property-read Collection<int, SurveyComment> $comments
 */
#[Fillable(['created_by_participant_id', 'kind', 'question', 'description', 'position', 'is_closed', 'show_voters', 'version'])]
class Survey extends Model
{
    /** @use HasFactory<SurveyFactory> */
    use HasFactory;

    use HasUuids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_closed' => false,
        'show_voters' => false,
        'version' => 1,
    ];

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'created_by_participant_id');
    }

    /** @return HasMany<SurveyOption, $this> */
    public function options(): HasMany
    {
        return $this->hasMany(SurveyOption::class)->orderBy('position');
    }

    /** @return HasMany<SurveyResponse, $this> */
    public function responses(): HasMany
    {
        return $this->hasMany(SurveyResponse::class);
    }

    /** @return HasMany<SurveyTextAnswer, $this> */
    public function textAnswers(): HasMany
    {
        return $this->hasMany(SurveyTextAnswer::class);
    }

    /** @return HasMany<SurveyReaction, $this> */
    public function reactions(): HasMany
    {
        return $this->hasMany(SurveyReaction::class)->oldest();
    }

    /** @return HasMany<SurveyComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(SurveyComment::class)->oldest();
    }

    public function responseCount(): int
    {
        if ($this->kind === SurveyKind::Text) {
            return $this->textAnswers()->count();
        }

        return $this->responses()->distinct()->count('participant_id');
    }

    public function commentCount(): int
    {
        return $this->comments()->whereNull('deleted_at')->count();
    }

    /**
     * @return SupportCollection<int, string>
     */
    public function answeredParticipantIds(): SupportCollection
    {
        return $this->responses()->pluck('participant_id')
            ->merge($this->textAnswers()->pluck('participant_id'))
            ->map(fn (mixed $participantId): string => (string) $participantId)
            ->unique()
            ->values();
    }

    public function hasAnswerFrom(Participant $participant): bool
    {
        return $this->responses()->where('participant_id', $participant->id)->exists()
            || $this->textAnswers()->where('participant_id', $participant->id)->exists();
    }

    public function isVisibleTo(Participant $participant): bool
    {
        return $this->is_closed || $this->hasAnswerFrom($participant);
    }

    protected function casts(): array
    {
        return [
            'kind' => SurveyKind::class,
            'position' => 'integer',
            'is_closed' => 'boolean',
            'show_voters' => 'boolean',
            'version' => 'integer',
        ];
    }
}
