<?php

namespace App\Models;

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use Database\Factories\TeamSurveyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
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
 * @property string $title
 * @property string|null $description
 * @property TeamSurveyTemplate|null $template
 * @property TeamSurveyStatus $status
 * @property string|null $facilitator_respondent_id
 * @property string|null $created_by_user_id
 * @property bool $guest_access_enabled
 * @property string $guest_token
 * @property bool $one_question_at_a_time
 * @property bool $show_results_after_answer
 * @property int $results_threshold
 * @property string|null $previous_survey_id
 * @property int $version
 * @property Carbon|null $opened_at
 * @property Carbon|null $closed_at
 * @property Carbon|null $created_at
 * @property-read Team $team
 * @property-read Retro|null $retro
 * @property-read Collection<int, TeamSurveyQuestion> $questions
 * @property-read Collection<int, TeamSurveyRespondent> $respondents
 */
#[Fillable([
    'retro_id', 'title', 'description', 'template', 'status', 'facilitator_respondent_id', 'created_by_user_id',
    'guest_access_enabled', 'guest_token', 'one_question_at_a_time', 'show_results_after_answer', 'results_threshold',
    'previous_survey_id', 'version', 'opened_at', 'closed_at',
])]
#[Hidden(['guest_token'])]
class TeamSurvey extends Model
{
    /** @use HasFactory<TeamSurveyFactory> */
    use HasFactory;

    use HasUuids;

    public const MaxQuestions = 30;

    public const StandaloneThreshold = 3;

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'draft',
        'guest_access_enabled' => false,
        'one_question_at_a_time' => true,
        'show_results_after_answer' => true,
        'results_threshold' => self::StandaloneThreshold,
        'version' => 1,
    ];

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

    /** @return HasMany<TeamSurveyQuestion, $this> */
    public function questions(): HasMany
    {
        return $this->hasMany(TeamSurveyQuestion::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<TeamSurveyRespondent, $this> */
    public function respondents(): HasMany
    {
        return $this->hasMany(TeamSurveyRespondent::class)->oldest()->orderBy('id');
    }

    /** @return BelongsTo<TeamSurveyRespondent, $this> */
    public function facilitator(): BelongsTo
    {
        return $this->belongsTo(TeamSurveyRespondent::class, 'facilitator_respondent_id');
    }

    /** @return BelongsTo<TeamSurvey, $this> */
    public function previous(): BelongsTo
    {
        return $this->belongsTo(self::class, 'previous_survey_id');
    }

    public function isHealthCheck(): bool
    {
        return $this->template === TeamSurveyTemplate::HealthCheck;
    }

    public function hasLockedQuestions(): bool
    {
        return $this->template?->hasLockedQuestions() ?? false;
    }

    public function isEditor(TeamSurveyRespondent $respondent): bool
    {
        if ($this->facilitator_respondent_id === $respondent->id) {
            return true;
        }

        return (bool) $respondent->user?->canManage($this->team->workspace);
    }

    public function resultsVisibleTo(TeamSurveyRespondent $respondent): bool
    {
        if ($this->status === TeamSurveyStatus::Draft) {
            return false;
        }

        if ($this->status === TeamSurveyStatus::Closed) {
            return true;
        }

        if ($this->isEditor($respondent)) {
            return true;
        }

        return $this->show_results_after_answer && $respondent->completed_at !== null;
    }

    public function responseCount(): int
    {
        return $this->respondents()->whereHas('answers')->count();
    }

    public function completedCount(): int
    {
        return $this->respondents()->whereNotNull('completed_at')->count();
    }

    public function hasAnswers(): bool
    {
        return TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', TeamSurveyQuestion::query()->where('team_survey_id', $this->id)->select('id'))
            ->exists();
    }

    /**
     * Everyone expected to answer: the team's members, plus the guests and
     * the people outside the team who answered, so that the share of people
     * who answered never exceeds 100 %. Someone outside the team who only
     * opened the page is not counted. An attached health check counts the
     * retro's participants instead (`PresentHealthProgress`).
     */
    public function audienceCount(): int
    {
        $memberIds = $this->team->members()->pluck('users.id');

        return $memberIds->count() + $this->respondents()
            ->where(fn (Builder $respondents) => $respondents
                ->whereNull('user_id')
                ->orWhere(fn (Builder $outsiders) => $outsiders->whereNotIn('user_id', $memberIds)->whereHas('answers')))
            ->count();
    }

    /**
     * The people who joined: the members and guests who opened the survey,
     * and the people outside the team once they answered.
     */
    public function participantCount(): int
    {
        $memberIds = $this->team->members()->pluck('users.id');

        return $this->respondents()
            ->where(fn (Builder $respondents) => $respondents
                ->whereNull('user_id')
                ->orWhereIn('user_id', $memberIds)
                ->orWhereHas('answers'))
            ->count();
    }

    protected function casts(): array
    {
        return [
            'template' => TeamSurveyTemplate::class,
            'status' => TeamSurveyStatus::class,
            'guest_access_enabled' => 'boolean',
            'one_question_at_a_time' => 'boolean',
            'show_results_after_answer' => 'boolean',
            'results_threshold' => 'integer',
            'version' => 'integer',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }
}
