<?php

namespace App\Http\Controllers\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\ResolveActionItemAssignee;
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
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ActionItemsController extends Controller
{
    public function __construct(private PresentActionItem $presentActionItem, private CreateActionItem $createActionItem, private ResolveActionItemAssignee $resolveActionItemAssignee) {}

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

            return $this->createActionItem->handle($locked->team, $locked, ActionItemActor::forParticipant($participant), [
                'content' => $validated['content'],
                ...($this->resolveActionItemAssignee->handle($locked->team, $locked, $validated) ?? []),
            ]);
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($actionItem, ActionItemActor::forParticipant($participant))], 201);
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

            $attributes = [
                ...Arr::except($validated, ['is_done', 'assignee_participant_id']),
                ...($this->resolveActionItemAssignee->handle($locked->team, $locked, $validated, $fresh) ?? []),
            ];

            if (array_key_exists('is_done', $validated)) {
                $attributes['completed_at'] = $validated['is_done'] ? now() : null;
            }

            $fresh->update($attributes);
            $fresh->loadForPresentation();

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
