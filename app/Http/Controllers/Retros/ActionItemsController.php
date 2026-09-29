<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentActionItem;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\ActionItemDeleted;
use App\Events\Retros\ActionItemSaved;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ActionItemsController extends Controller
{
    public function __construct(private PresentActionItem $presentActionItem) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:500'],
            'assignee_participant_id' => $this->assigneeRules($retro),
        ]);

        $actionItem = DB::transaction(function () use ($retro, $participant, $validated): ActionItem {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Discussing);
            RetroGuard::unlocked($locked);

            $actionItem = $locked->actionItems()->create([
                ...$validated,
                'created_by_participant_id' => $participant->id,
            ]);

            $actionItem->load('assignee.user');

            (new ActionItemSaved($locked->id, $this->presentActionItem->handle($actionItem)))->sendToOthers();

            return $actionItem;
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($actionItem)], 201);
    }

    public function update(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);

        $validated = $request->validate([
            'content' => ['sometimes', 'required', 'string', 'max:500'],
            'assignee_participant_id' => ['sometimes', ...$this->assigneeRules($retro)],
            'is_done' => ['sometimes', 'boolean'],
        ]);

        $updated = DB::transaction(function () use ($retro, $actionItem, $validated): ActionItem {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Discussing);
            RetroGuard::unlocked($locked);

            $fresh = $locked->actionItems()->whereKey($actionItem->id)->firstOrFail();

            $fresh->update($validated);
            $fresh->load('assignee.user');

            (new ActionItemSaved($locked->id, $this->presentActionItem->handle($fresh)))->sendToOthers();

            return $fresh;
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($updated)]);
    }

    public function destroy(Request $request, Retro $retro, ActionItem $actionItem): Response
    {
        Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);

        DB::transaction(function () use ($retro, $actionItem): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Discussing);
            RetroGuard::unlocked($locked);

            $fresh = $locked->actionItems()->whereKey($actionItem->id)->firstOrFail();

            $fresh->delete();

            (new ActionItemDeleted($locked->id, $fresh->id))->sendToOthers();
        });

        return response()->noContent();
    }

    /**
     * @return array<int, mixed>
     */
    private function assigneeRules(Retro $retro): array
    {
        return ['nullable', 'uuid', Rule::exists('participants', 'id')->where('retro_id', $retro->id)];
    }
}
