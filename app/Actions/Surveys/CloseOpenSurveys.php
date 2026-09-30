<?php

namespace App\Actions\Surveys;

use App\Models\Retro;
use Illuminate\Support\Facades\DB;

class CloseOpenSurveys
{
    public function handle(Retro $locked): void
    {
        $locked->surveys()->where('is_closed', false)->update([
            'is_closed' => true,
            'version' => DB::raw('version + 1'),
        ]);
    }
}
