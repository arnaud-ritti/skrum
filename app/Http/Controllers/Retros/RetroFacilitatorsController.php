<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\RetroSettingsChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RetroFacilitatorsController extends Controller
{
    public function update(Request $request, Retro $retro): Response
    {
        $participant = Participant::current($request);

        if (! $retro->isFacilitator($participant) && ! $this->mayTakeControl($retro, $participant)) {
            RetroGuard::facilitator($retro, $participant);
        }

        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
        ]);

        $user = User::query()->whereKey($validated['user_id'])->firstOrFail();

        DB::transaction(function () use ($retro, $participant, $user): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $locked->isFacilitator($participant)
                ? $this->ensureCanHandOver($locked, $user)
                : $this->ensureTakesControl($locked, $participant, $user);

            $newFacilitator = Participant::query()->firstOrCreate(['retro_id' => $locked->id, 'user_id' => $user->id]);

            $locked->update(['facilitator_participant_id' => $newFacilitator->id]);

            (new RetroSettingsChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    private function ensureCanHandOver(Retro $locked, User $user): void
    {
        if ($user->can('view', $locked->team)) {
            return;
        }

        throw ValidationException::withMessages(['user_id' => __('The facilitator must be a member of this team.')]);
    }

    /**
     * A team facilitator, owner or workspace admin may make themselves the facilitator
     * of an open retro (owner's decision 2 B); nobody else, and never for someone else.
     */
    private function ensureTakesControl(Retro $locked, Participant $participant, User $user): void
    {
        if ($participant->user_id !== $user->id || ! $this->mayTakeControl($locked, $participant)) {
            throw new AuthorizationException(__('Only the facilitator can do this.'));
        }
    }

    private function mayTakeControl(Retro $retro, Participant $participant): bool
    {
        if ($participant->isGuest()) {
            return false;
        }

        if ($retro->phase === RetroPhase::Completed) {
            return false;
        }

        return $participant->user?->can('takeControl', $retro->team) ?? false;
    }
}
