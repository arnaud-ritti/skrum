<?php

namespace App\Http\Controllers\Retros;

use App\Actions\HealthCheck\PresentHealthProgress;
use App\Actions\Retros\MarkRetroStarted;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\HealthAnswered;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HealthCheckAnswersController extends Controller
{
    public function __construct(
        private PresentHealthProgress $presentHealthProgress,
        private MarkRetroStarted $markRetroStarted,
    ) {}

    public function update(Request $request, Retro $retro, string $statement): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'score' => ['required', 'integer', 'min:1', 'max:10'],
        ]);

        $score = (int) $validated['score'];

        $progress = DB::transaction(function () use ($retro, $participant, $statement, $score): array {
            $locked = $this->lock($retro, $statement);

            $locked->healthCheckAnswers()->updateOrCreate(
                ['participant_id' => $participant->id, 'statement' => $statement],
                ['score' => $score],
            );

            $this->markRetroStarted->handle($locked);

            return $this->broadcastProgress($locked);
        });

        return response()->json(['statement' => $statement, 'score' => $score, 'statements' => $progress]);
    }

    public function destroy(Request $request, Retro $retro, string $statement): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $progress = DB::transaction(function () use ($retro, $participant, $statement): array {
            $locked = $this->lock($retro, $statement);

            $locked->healthCheckAnswers()
                ->where('participant_id', $participant->id)
                ->where('statement', $statement)
                ->delete();

            return $this->broadcastProgress($locked);
        });

        return response()->json(['statements' => $progress]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::HealthCheck);
        RetroGuard::unlocked($retro);
    }

    private function lock(Retro $retro, string $statement): Retro
    {
        $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

        $this->guard($locked);

        abort_unless($locked->healthStatements()->where('key', $statement)->exists(), 404);

        return $locked;
    }

    /**
     * @return array<int, array{key: string, count: int, answeredBy: array<int, string>}>
     */
    private function broadcastProgress(Retro $retro): array
    {
        $progress = $this->presentHealthProgress->handle($retro);

        (new HealthAnswered($retro->id, $progress))->sendToOthers();

        return $progress;
    }
}
