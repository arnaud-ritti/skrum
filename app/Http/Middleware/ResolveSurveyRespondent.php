<?php

namespace App\Http\Middleware;

use App\Actions\Retros\GuestCookie;
use App\Actions\TeamSurveys\ResolveRespondent;
use App\Http\Middleware\Concerns\RefusesMissingMember;
use App\Models\TeamSurvey;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveSurveyRespondent
{
    use RefusesMissingMember;

    private const array RetroPages = ['surveys.show', 'surveys.results.show'];

    public function __construct(private ResolveRespondent $resolveRespondent) {}

    public function handle(Request $request, Closure $next): Response
    {
        $survey = $request->route('teamSurvey');

        abort_unless($survey instanceof TeamSurvey, 404);

        if ($survey->retro_id !== null) {
            return $this->sendToRetro($request, $survey);
        }

        $respondent = $this->resolveRespondent->handle($request, $survey);

        if ($respondent === null) {
            return $this->refuseMissingMember($request, $survey->guest_access_enabled, GuestCookie::name(GuestCookie::SurveyScope, $survey->id), __('You no longer have access to this survey.'));
        }

        $request->attributes->set('surveyRespondent', $respondent);

        return $next($request);
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

        return to_route('retros.show', $survey->retro_id);
    }
}
