<?php

namespace App\Http\Controllers\Retros;

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\HealthCheck\PresentHealthProgress;
use App\Actions\Retros\MarkRetroStarted;
use App\Actions\Retros\RetroGuard;
use App\Actions\TeamSurveys\RespondentForParticipant;
use App\Actions\TeamSurveys\SaveSurveyAnswer;
use App\Enums\TeamSurveyStatus;
use App\Events\Retros\HealthAnswered;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class RetroHealthCheckSubmissionsController extends Controller
{
    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private RespondentForParticipant $respondentForParticipant,
        private SaveSurveyAnswer $saveSurveyAnswer,
        private PresentHealthProgress $presentHealthProgress,
        private MarkRetroStarted $markRetroStarted,
    ) {}

    /**
     * "Submit answers": every statement scored at once, once. The retro is
     * locked first, then its health check, as on every retro route; the
     * scores are validated against the questions read under those locks.
     */
    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $progress = DB::transaction(function () use ($request, $retro, $participant): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $found = $this->healthCheckSurvey->forRetro($locked);

            abort_if($found === null, 404);

            $survey = TeamSurvey::query()->whereKey($found->id)->lockForUpdate()->firstOrFail();

            if ($survey->status !== TeamSurveyStatus::Open) {
                throw ValidationException::withMessages(['health_check' => __('The health check is closed.')]);
            }

            $respondent = $this->respondentForParticipant->handle($survey, $participant);

            if ($respondent->hasSubmitted()) {
                throw ValidationException::withMessages(['health_check' => __('You have already sent your answers.')]);
            }

            $questions = $survey->questions()->get()->keyBy('match_key');
            $validated = Validator::make($request->all(), $this->rules($questions), $this->messages($questions))->validate();

            foreach ($questions as $key => $question) {
                $this->saveSurveyAnswer->handle($question, $respondent, ['value' => (int) $validated['scores'][$key]]);
            }

            $respondent->update(['completed_at' => now()]);

            $this->markRetroStarted->handle($locked);

            $progress = $this->presentHealthProgress->forSurvey($survey, $locked);

            new HealthAnswered($locked->id, $progress['respondents'], $progress['participants'])->sendToOthers();

            return $progress;
        });

        return response()->json([
            'respondents' => $progress['respondents'],
            'participants' => $progress['participants'],
            'hasSubmitted' => true,
        ]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::open($retro);
        RetroGuard::unlocked($retro);
    }

    /**
     * @param  Collection<string, TeamSurveyQuestion>  $questions
     * @return array<string, array<int, mixed>>
     */
    private function rules(Collection $questions): array
    {
        $rules = ['scores' => ['required', 'array:'.$questions->keys()->implode(',')]];

        foreach ($questions as $key => $question) {
            $rules["scores.{$key}"] = ['required', 'integer', 'min:1', 'max:'.(int) $question->scale_max];
        }

        return $rules;
    }

    /**
     * @param  Collection<string, TeamSurveyQuestion>  $questions
     * @return array<string, string>
     */
    private function messages(Collection $questions): array
    {
        return $questions->keys()
            ->mapWithKeys(fn (string $key): array => ["scores.{$key}.required" => __('Score every statement before sending.')])
            ->all();
    }
}
