<?php

namespace App\Http\Middleware;

use App\Actions\Retros\GuestCookie;
use App\Actions\TeamSurveys\ResolveRespondent;
use App\Models\TeamSurvey;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolveSurveyRespondent
{
    private const RetroPages = ['surveys.show', 'surveys.results.show'];

    public function __construct(private ResolveRespondent $resolveRespondent) {}

    public function handle(Request $request, Closure $next): Response
    {
        $survey = $request->route('teamSurvey');

        abort_unless($survey instanceof TeamSurvey, 404);

        if ($survey->retro_id !== null) {
            return $this->sendToRetro($request, $survey);
        }

        $respondent = $this->resolveRespondent->handle($request, $survey);

        if ($respondent === null && $request->user() === null && ! $request->expectsJson()) {
            return $this->sendToLogin($request, $survey);
        }

        if ($respondent === null) {
            $hasGuestCookie = $request->cookies->has(GuestCookie::name(GuestCookie::SurveyScope, $survey->id));

            abort_if($request->user() === null && ! $hasGuestCookie, 401, __('Your session has expired.'));

            abort(403, __('You no longer have access to this survey.'));
        }

        $request->attributes->set('surveyRespondent', $respondent);

        return $next($request);
    }

    /**
     * Once the guest cookie is gone, an expired guest cannot be told apart
     * from a logged-out member, so guest-enabled surveys explain both ways back.
     */
    private function sendToLogin(Request $request, TeamSurvey $survey): Response
    {
        if (! $survey->guest_access_enabled) {
            return redirect()->guest(route('login'));
        }

        redirect()->setIntendedUrl($request->fullUrl());

        return Inertia::render('retros/session-ended')->toResponse($request);
    }

    /**
     * An attached health check is answered, closed and read in its retro
     * (spec §6.3, decision 10): its two pages lead there, the rest of the
     * survey scope does not exist for it. The retro's own middleware decides
     * who may enter.
     */
    private function sendToRetro(Request $request, TeamSurvey $survey): Response
    {
        abort_unless($request->isMethod('GET'), 404);
        abort_if($request->expectsJson(), 404);
        abort_unless(in_array($request->route()?->getName(), self::RetroPages, true), 404);

        return redirect()->route('retros.show', $survey->retro_id);
    }
}
