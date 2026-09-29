<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentColumns;
use App\Actions\Retros\RetroGuard;
use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Events\Retros\ColumnsChanged;
use App\Http\Controllers\Controller;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ColumnsController extends Controller
{
    public function __construct(private PresentColumns $presentColumns) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        $this->authorizeEditing($retro, $participant);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:60'],
            'color' => ['required', Rule::enum(ColumnColor::class)],
        ]);

        return $this->respond($retro, $participant, function (Retro $locked) use ($validated): void {
            $locked->columns()->create([
                ...$validated,
                'position' => $locked->columns()->count(),
            ]);
        }, 201);
    }

    public function update(Request $request, Retro $retro, Column $column): JsonResponse
    {
        $participant = Participant::current($request);

        $this->authorizeEditing($retro, $participant);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:60'],
            'color' => ['sometimes', Rule::enum(ColumnColor::class)],
        ]);

        return $this->respond($retro, $participant, function (Retro $locked) use ($column, $validated): void {
            $lockedColumn = $locked->columns()->whereKey($column->id)->firstOrFail();

            $this->ensureEmpty($lockedColumn);

            $lockedColumn->update($validated);
        });
    }

    public function destroy(Request $request, Retro $retro, Column $column): JsonResponse
    {
        $participant = Participant::current($request);

        $this->authorizeEditing($retro, $participant);

        return $this->respond($retro, $participant, function (Retro $locked) use ($column): void {
            $lockedColumn = $locked->columns()->whereKey($column->id)->firstOrFail();

            $this->ensureEmpty($lockedColumn);

            $lockedColumn->delete();

            foreach ($locked->columns()->get()->values() as $position => $remaining) {
                $remaining->update(['position' => $position]);
            }
        });
    }

    private function authorizeEditing(Retro $retro, Participant $participant): void
    {
        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing);
    }

    private function ensureEmpty(Column $column): void
    {
        if (! $column->cards()->exists()) {
            return;
        }

        throw ValidationException::withMessages(['column' => __('This column still has cards.')]);
    }

    private function respond(Retro $retro, Participant $participant, callable $change, int $status = 200): JsonResponse
    {
        $columns = DB::transaction(function () use ($retro, $participant, $change): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->authorizeEditing($locked, $participant);

            $change($locked);

            $columns = $this->presentColumns->handle($locked);

            (new ColumnsChanged($locked->id, $columns))->sendToOthers();

            return $columns;
        });

        return response()->json(['columns' => $columns], $status);
    }
}
