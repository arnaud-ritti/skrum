<?php

namespace App\Actions\Surveys;

use App\Models\Retro;

class CloseOpenSurveys
{
    public function handle(Retro $locked): void
    {
        $locked->surveys()->where('is_closed', false)->increment('version', 1, ['is_closed' => true]);
    }
}
