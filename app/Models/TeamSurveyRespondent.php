<?php

namespace App\Models;

use App\Concerns\HasGuestIdentity;
use Database\Factories\TeamSurveyRespondentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_survey_id
 * @property string|null $user_id
 * @property string|null $participant_id
 * @property string|null $guest_name
 * @property string|null $guest_secret_hash
 * @property Carbon|null $completed_at
 * @property int|null $presence_color
 * @property-read TeamSurvey $survey
 * @property-read User|null $user
 */
#[Fillable(['team_survey_id', 'user_id', 'participant_id', 'guest_name', 'guest_secret_hash', 'completed_at', 'presence_color'])]
#[Hidden(['guest_secret_hash'])]
class TeamSurveyRespondent extends Model
{
    /** @use HasFactory<TeamSurveyRespondentFactory> */
    use HasFactory;

    use HasGuestIdentity {
        presenceColor as private identityPresenceColor;
    }
    use HasUuids;

    public static function current(Request $request): self
    {
        $respondent = $request->attributes->get('surveyRespondent');

        abort_unless($respondent instanceof self, 403);

        return $respondent;
    }

    /** @return BelongsTo<TeamSurvey, $this> */
    public function survey(): BelongsTo
    {
        return $this->belongsTo(TeamSurvey::class, 'team_survey_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    /**
     * A respondent who answers for a retro participant wears that
     * participant's colour, so a guest keeps one colour across both.
     */
    public function presenceColor(): int
    {
        if ($this->participant_id !== null && $this->participant !== null) {
            return $this->participant->presenceColor();
        }

        return $this->identityPresenceColor();
    }

    /** @return HasMany<TeamSurveyAnswer, $this> */
    public function answers(): HasMany
    {
        return $this->hasMany(TeamSurveyAnswer::class);
    }

    public function hasSubmitted(): bool
    {
        return $this->completed_at !== null;
    }

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
            'presence_color' => 'integer',
        ];
    }
}
