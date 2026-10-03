<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;

/**
 * Registered now so the snapshot can name the results page; Task 10 fills it.
 * The bound survey is what lets the middleware of the survey scope run.
 */
class TeamSurveyResultsController extends Controller
{
    public function show(TeamSurvey $teamSurvey): never
    {
        abort(404);
    }
}
