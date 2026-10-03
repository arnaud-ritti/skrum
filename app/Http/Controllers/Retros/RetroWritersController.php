<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\WritingCountChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The writing heartbeat of an anonymous retro (spec §6.11): `update` says
 * "I am writing" for the next few seconds, `destroy` says "I stopped".
 * One row written, no lock: a count read a moment early is corrected by the
 * next heartbeat.
 */
class RetroWritersController extends Controller
{
    public const int WritingSeconds = 8;

    public function update(Request $request, Retro $retro): JsonResponse
    {
        return response()->json(['count' => $this->write($request, $retro, now()->addSeconds(self::WritingSeconds))]);
    }

    public function destroy(Request $request, Retro $retro): JsonResponse
    {
        return response()->json(['count' => $this->write($request, $retro, null)]);
    }

    private function write(Request $request, Retro $retro, ?CarbonInterface $writingUntil): int
    {
        $participant = Participant::current($request);

        abort_unless($retro->is_anonymous, 403);
        RetroGuard::phase($retro, RetroPhase::Writing);
        RetroGuard::unlocked($retro);

        Participant::query()->whereKey($participant->id)->update(['writing_until' => $writingUntil]);

        $count = $retro->participants()->where('writing_until', '>', now())->count();

        (new WritingCountChanged($retro->id, $count))->sendToOthers();

        return $count;
    }
}
