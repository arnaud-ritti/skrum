<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Enums\SummaryStatus;
use App\Events\Retros\InsightsChanged;
use App\Events\Retros\ResultsChanged;
use App\Models\Retro;
use Illuminate\Support\Facades\DB;

class ClearRetroInsights
{
    /**
     * Handled suggestions stay: history is not rewritten.
     */
    public function clear(Retro $locked): void
    {
        $locked->suggestedActions()->where('status', SuggestedActionStatus::Pending)->delete();
        $locked->themes()->delete();
        $locked->cards()->update(['sentiment' => null, 'category' => null]);
    }

    /**
     * Everything a summary deletion clears; the caller broadcasts.
     */
    public function remove(Retro $locked, ?SummaryStatus $status = null): void
    {
        $this->clear($locked);

        $locked->update([
            'summary' => null,
            'summary_generated_at' => null,
            'summary_requested_at' => null,
            'summary_status' => $status,
        ]);
    }

    /**
     * Only a still-pending request fails: a newer result or a deliberate deletion stays.
     */
    public function fail(string $retroId): void
    {
        DB::transaction(function () use ($retroId): void {
            $locked = Retro::query()->whereKey($retroId)->lockForUpdate()->first();

            if ($locked === null) {
                return;
            }

            if ($locked->summary_status !== SummaryStatus::Pending) {
                return;
            }

            if ($locked->phase !== RetroPhase::Completed) {
                $this->abandon($locked);

                return;
            }

            $this->remove($locked, SummaryStatus::Failed);

            new ResultsChanged($locked->id)->sendToOthers();
            new InsightsChanged($locked->id)->sendToOthers();
        });
    }

    /**
     * A job that will not run (retro reopened, provider removed) must not
     * leave a "Generating…" state behind.
     */
    public function abandon(Retro $locked): void
    {
        if ($locked->summary_status !== SummaryStatus::Pending) {
            return;
        }

        $locked->update(['summary_status' => null, 'summary_requested_at' => null]);

        new ResultsChanged($locked->id)->sendToOthers();
    }
}
