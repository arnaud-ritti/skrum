<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentColumns;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\ColumnsChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ColumnOrdersController extends Controller
{
    public function __construct(private PresentColumns $presentColumns) {}

    public function update(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing);

        $validated = $request->validate([
            'column_ids' => ['required', 'array'],
            'column_ids.*' => ['uuid', 'distinct'],
        ]);

        $columns = DB::transaction(function () use ($retro, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::phase($locked, RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing);

            $currentIds = $locked->columns()->pluck('id')->all();
            $requestedIds = $validated['column_ids'];

            sort($currentIds);
            sort($requestedIds);

            if ($currentIds !== $requestedIds) {
                throw ValidationException::withMessages(['column_ids' => __('Send every column of this retrospective exactly once.')]);
            }

            foreach ($validated['column_ids'] as $position => $columnId) {
                $locked->columns()->whereKey($columnId)->update(['position' => $position]);
            }

            $columns = $this->presentColumns->handle($locked);

            (new ColumnsChanged($locked->id, $columns))->sendToOthers();

            return $columns;
        });

        return response()->json(['columns' => $columns]);
    }
}
