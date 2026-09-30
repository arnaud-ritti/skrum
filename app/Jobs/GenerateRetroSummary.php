<?php

namespace App\Jobs;

use App\Actions\Retros\BuildSummaryInput;
use App\Actions\Retros\ClearRetroInsights;
use App\Actions\Retros\ParseSummaryOutput;
use App\Actions\Retros\StoreRetroInsights;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Models\Retro;
use App\Support\Llm\InvalidLlmOutput;
use App\Support\Llm\Llm;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class GenerateRetroSummary implements ShouldBeUniqueUntilProcessing, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 75;

    public int $uniqueFor = 540;

    public function __construct(public string $retroId) {}

    public function uniqueId(): string
    {
        return $this->retroId;
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 60];
    }

    public function handle(
        Llm $llm,
        BuildSummaryInput $buildSummaryInput,
        ParseSummaryOutput $parseSummaryOutput,
        StoreRetroInsights $storeRetroInsights,
        ClearRetroInsights $clearRetroInsights,
    ): void {
        $retro = Retro::query()->find($this->retroId);

        if ($retro === null) {
            return;
        }

        if ($this->shouldAbort($retro, $llm)) {
            DB::transaction(fn () => $clearRetroInsights->abandon(
                Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail(),
            ));

            return;
        }

        $input = $buildSummaryInput->handle($retro);
        $output = $parseSummaryOutput->handle($llm->client()->complete($input->instructions, $input->payload), $input);

        if ($output === null) {
            throw new InvalidLlmOutput;
        }

        $storeRetroInsights->handle($retro, $output);
    }

    /**
     * Only a still-pending request may reach the provider: a reopen, an opt-out
     * or a deletion since queueing withdraws it.
     */
    private function shouldAbort(Retro $retro, Llm $llm): bool
    {
        if ($retro->phase !== RetroPhase::Completed) {
            return true;
        }

        if ($retro->summary_status !== SummaryStatus::Pending) {
            return true;
        }

        return ! $llm->isConfigured();
    }

    /**
     * Only the exception class is logged: messages could carry board content.
     */
    public function failed(?Throwable $exception): void
    {
        Log::warning('Retro summary generation failed.', [
            'retroId' => $this->retroId,
            'reason' => $exception === null ? null : $exception::class,
        ]);

        app(ClearRetroInsights::class)->fail($this->retroId);
    }
}
