<?php

namespace App\Http\Controllers\Whiteboards;

use App\Events\Whiteboards\WhiteboardChanged;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WhiteboardFacilitatorsController extends Controller
{
    public function update(Request $request, Whiteboard $board): Response
    {
        $member = WhiteboardMember::current($request);

        if ($member->isGuest()) {
            throw new AuthorizationException(__('Only the facilitator can do this.'));
        }

        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
        ]);

        $user = User::query()->whereKey($validated['user_id'])->firstOrFail();

        DB::transaction(function () use ($board, $member, $user): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            $locked->isFacilitator($member)
                ? $this->ensureCanHandOver($locked, $user)
                : $this->ensureTakesControl($locked, $member, $user);

            $newFacilitator = WhiteboardMember::query()->firstOrCreate(['whiteboard_id' => $locked->id, 'user_id' => $user->id]);

            $locked->update(['facilitator_member_id' => $newFacilitator->id, 'follow_enabled' => false]);

            (new WhiteboardChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    /**
     * The new facilitator must take part in the team: an observer only keeps a session they already facilitated.
     */
    private function ensureCanHandOver(Whiteboard $locked, User $user): void
    {
        if ($user->can('createWhiteboard', $locked->team)) {
            return;
        }

        throw ValidationException::withMessages(['user_id' => __('The facilitator must be a member of this team.')]);
    }

    /**
     * A board outlives its sessions, so a missing facilitator must not
     * freeze it: any team member may make themselves facilitator.
     */
    private function ensureTakesControl(Whiteboard $locked, WhiteboardMember $member, User $user): void
    {
        if ($member->user_id !== $user->id || ! $user->can('view', $locked->team)) {
            throw new AuthorizationException(__('Only the facilitator can do this.'));
        }
    }
}
