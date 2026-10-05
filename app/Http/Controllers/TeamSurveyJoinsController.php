<?php

namespace App\Http\Controllers;

use App\Actions\Retros\GuestCookie;
use App\Actions\Sessions\PresentJoinSession;
use App\Actions\TeamSurveys\ResolveRespondent;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Concerns\JoinsAsGuest;
use App\Models\TeamSurvey;
use App\Support\Avatars\PresenceColor;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class TeamSurveyJoinsController extends Controller
{
    use JoinsAsGuest;

    public function show(Request $request, string $guestToken, ResolveRespondent $resolveRespondent, PresentJoinSession $presentJoinSession): Response
    {
        $survey = $this->findSurvey($guestToken);

        if ($survey === null) {
            return $this->invalidLink($request, 'surveys/join');
        }

        if ($resolveRespondent->handle($request, $survey) !== null) {
            return to_route('surveys.show', $survey);
        }

        return Inertia::render('surveys/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'session' => $presentJoinSession->survey($survey),
            ...$presentJoinSession->nickname($request->user()),
            ...$presentJoinSession->colours($survey->respondents()->with(['user', 'participant.user'])->get(), $request->user()),
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, ResolveRespondent $resolveRespondent): Response
    {
        $survey = $this->findSurvey($guestToken);

        if ($survey === null) {
            return $this->invalidLink($request, 'surveys/join');
        }

        if ($resolveRespondent->handle($request, $survey) !== null) {
            return to_route('surveys.show', $survey);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'presence' => ['sometimes', 'nullable', 'integer', 'between:1,'.PresenceColor::Count],
        ]);

        $cookie = $this->createGuest($survey->respondents(), GuestCookie::SurveyScope, $survey->id, [
            'guest_name' => $validated['name'],
            'presence_color' => $validated['presence'] ?? null,
        ]);

        return to_route('surveys.show', $survey)
            ->withCookie($cookie);
    }

    /**
     * An attached health check is answered in its retro only (spec §6.3),
     * and a draft is not open to guests yet.
     */
    private function findSurvey(string $guestToken): ?TeamSurvey
    {
        return TeamSurvey::query()
            ->where('guest_token', $guestToken)
            ->where('guest_access_enabled', true)
            ->where('status', '!=', TeamSurveyStatus::Draft)
            ->whereNull('retro_id')
            ->first();
    }
}
