<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\PresentSurvey;
use App\Actions\Surveys\SurveyGuard;
use App\Enums\SurveyKind;
use App\Events\Retros\SurveyChanged;
use App\Events\Retros\SurveyDeleted;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SurveysController extends Controller
{
    private const int MaxSurveys = 10;

    private const int MinOptions = 2;

    private const int MaxOptions = 10;

    public function __construct(private PresentSurvey $presentSurvey) {}

    public function show(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        return response()->json(['survey' => $this->presentSurvey->handle($survey, $retro, Participant::current($request))]);
    }

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->authorizeEditing($retro, $participant);

        $validated = $this->validateSurvey($request, $retro, null);

        [$survey, $presentingRetro] = DB::transaction(function () use ($retro, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->authorizeEditing($locked, $participant);
            SurveyGuard::namesAllowed($locked, $validated['show_voters']);

            if ($locked->surveys()->count() >= self::MaxSurveys) {
                throw ValidationException::withMessages(['survey' => __('A retrospective can have at most 10 surveys.')]);
            }

            $lastPosition = $locked->surveys()->max('position');

            $survey = $locked->surveys()->create([
                'created_by_participant_id' => $participant->id,
                'kind' => $validated['kind'],
                'question' => $validated['question'],
                'description' => $validated['description'],
                'show_voters' => $validated['show_voters'],
                'position' => $lastPosition === null ? 0 : $lastPosition + 1,
            ]);

            $this->replaceOptions($survey, $validated['options']);

            SurveyChanged::for($survey)->sendToOthers();

            return [$survey, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($survey, $presentingRetro, $participant)], 201);
    }

    public function update(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        $participant = Participant::current($request);

        if ($request->keys() === ['show_voters']) {
            return $this->updateVoterVisibility($request, $retro, $survey, $participant);
        }

        $this->authorizeEditing($retro, $participant);

        $validated = $this->validateSurvey($request, $retro, $survey);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->authorizeEditing($locked, $participant);
            SurveyGuard::namesAllowed($locked, $validated['show_voters']);

            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            SurveyGuard::unanswered($fresh);

            $fresh->fill([
                'kind' => $validated['kind'],
                'question' => $validated['question'],
                'description' => $validated['description'],
                'show_voters' => $validated['show_voters'],
            ]);
            $fresh->version++;
            $fresh->save();

            $this->replaceOptions($fresh, $validated['options']);

            SurveyChanged::for($fresh)->sendToOthers();

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, Survey $survey): Response
    {
        $participant = Participant::current($request);

        $this->authorizeEditing($retro, $participant);

        DB::transaction(function () use ($retro, $survey, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->authorizeEditing($locked, $participant);

            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            $fresh->delete();

            (new SurveyDeleted($locked->id, $fresh->id))->sendToOthers();
        });

        return response()->noContent();
    }

    private function updateVoterVisibility(Request $request, Retro $retro, Survey $survey, Participant $participant): JsonResponse
    {
        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        $showVoters = (bool) $request->validate(['show_voters' => ['required', 'boolean']])['show_voters'];

        SurveyGuard::namesAllowed($retro, $showVoters);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant, $showVoters): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);
            SurveyGuard::namesAllowed($locked, $showVoters);

            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            if ($fresh->show_voters !== $showVoters) {
                $fresh->show_voters = $showVoters;
                $fresh->version++;
                $fresh->save();

                SurveyChanged::for($fresh)->sendToOthers();
            }

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }

    private function authorizeEditing(Retro $retro, Participant $participant): void
    {
        RetroGuard::facilitator($retro, $participant);
        SurveyGuard::activePhase($retro);
        RetroGuard::unlocked($retro);
    }

    /**
     * @return array{
     *     kind: SurveyKind,
     *     question: string,
     *     description: ?string,
     *     options: array<int, string>,
     *     show_voters: bool
     * }
     */
    private function validateSurvey(Request $request, Retro $retro, ?Survey $existing): array
    {
        $validated = $request->validate([
            'kind' => ['sometimes', Rule::enum(SurveyKind::class)],
            'question' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:500'],
            'options' => ['sometimes', 'array'],
            'options.*' => ['required', 'string', 'max:100'],
            'show_voters' => ['sometimes', 'boolean'],
        ]);

        $kind = isset($validated['kind']) ?
            SurveyKind::from($validated['kind']) :
            ($existing === null ? SurveyKind::Single : $existing->kind);
        $options = array_values($validated['options'] ?? []);

        $this->ensureOptionsMatch($kind, $options);

        $inheritsVoters = $existing !== null && ! $retro->is_anonymous;
        $showVoters = (bool) ($validated['show_voters'] ?? ($inheritsVoters && $existing->show_voters));

        SurveyGuard::namesAllowed($retro, $showVoters);

        return [
            'kind' => $kind,
            'question' => $validated['question'],
            'description' => $validated['description'] ?? null,
            'options' => $options,
            'show_voters' => $showVoters,
        ];
    }

    /**
     * @param  array<int, string>  $options
     */
    private function ensureOptionsMatch(SurveyKind $kind, array $options): void
    {
        if (! $kind->isChoice() && $options !== []) {
            throw ValidationException::withMessages(['options' => __('Free-text surveys have no options.')]);
        }

        if (! $kind->isChoice()) {
            return;
        }

        if (count($options) >= self::MinOptions && count($options) <= self::MaxOptions) {
            return;
        }

        throw ValidationException::withMessages(['options' => __('Choice surveys need between 2 and 10 options.')]);
    }

    /**
     * @param  array<int, string>  $labels
     */
    private function replaceOptions(Survey $survey, array $labels): void
    {
        $survey->options()->delete();

        foreach ($labels as $position => $label) {
            $survey->options()->create(['label' => $label, 'position' => $position]);
        }
    }
}
