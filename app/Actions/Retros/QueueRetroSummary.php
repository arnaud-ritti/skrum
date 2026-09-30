<?php

namespace App\Actions\Retros;

use App\Enums\SummaryStatus;
use App\Events\Retros\ResultsChanged;
use App\Jobs\GenerateRetroSummary;
use App\Models\Retro;

class QueueRetroSummary
{
    public function handle(Retro $locked): void
    {
        $locked->update([
            'summary_status' => SummaryStatus::Pending,
            'summary_requested_at' => now(),
        ]);

        GenerateRetroSummary::dispatch($locked->id)->afterCommit();

        (new ResultsChanged($locked->id))->sendToOthers();
    }
}
