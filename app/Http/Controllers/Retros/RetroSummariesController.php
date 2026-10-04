<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\ClearRetroInsights;
use App\Actions\Retros\QueueRetroSummary;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Events\Retros\InsightsChanged;
use App\Events\Retros\ResultsChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Llm\Llm;
use App\Support\Llm\LlmRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class RetroSummariesController extends Controller
{
    private const int RequestsPerMinute = 5;

    public function __construct(
        private Llm $llm,
        private QueueRetroSummary $queueRetroSummary,
        private ClearRetroInsights $clearRetroInsights,
    ) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        abort_unless($this->llm->isConfigured(), 404);

        $this->guard($retro, $participant);

        LlmRateLimit::hit("retro-summary:{$retro->id}", self::RequestsPerMinute);

        DB::transaction(function () use ($retro, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked, $participant);

            if ($locked->effectiveSummaryStatus() === SummaryStatus::Pending) {
                return;
            }

            $this->queueRetroSummary->handle($locked);
        });

        return response()->json(['status' => SummaryStatus::Pending->value], 202);
    }

    public function destroy(Request $request, Retro $retro): Response
    {
        $participant = Participant::current($request);

        abort_unless($this->llm->isConfigured(), 404);

        $this->guard($retro, $participant);

        DB::transaction(function () use ($retro, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked, $participant);

            $this->clearRetroInsights->remove($locked);

            new ResultsChanged($locked->id)->sendToOthers();
            new InsightsChanged($locked->id)->sendToOthers();
        });

        return response()->noContent();
    }

    private function guard(Retro $retro, Participant $participant): void
    {
        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::Completed);
    }
}
