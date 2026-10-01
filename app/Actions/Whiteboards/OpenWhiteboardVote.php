<?php

namespace App\Actions\Whiteboards;

use App\Events\Whiteboards\WhiteboardChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVoteSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OpenWhiteboardVote
{
    /**
     * The scope is fixed here: the live sticky notes of the board, or those
     * whose stored frame is the given one (spec §11.4).
     */
    public function handle(Whiteboard $board, WhiteboardMember $member, int $votesPerMember, ?string $frameElementId, bool $allowMultiple): WhiteboardVoteSession
    {
        return DB::transaction(function () use ($board, $member, $votesPerMember, $frameElementId, $allowMultiple): WhiteboardVoteSession {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);
            WhiteboardGuard::noOpenVoteSession($locked);

            if ($frameElementId !== null && ! $this->isLiveFrame($locked, $frameElementId)) {
                throw ValidationException::withMessages(['frame_element_id' => __('Choose a frame of this board.')]);
            }

            $elementIds = $locked->elements()
                ->where('is_sticky', true)
                ->where('is_deleted', false)
                ->get()
                ->filter(fn (WhiteboardElement $note): bool => $frameElementId === null || ($note->data['frameId'] ?? null) === $frameElementId)
                ->pluck('element_id')
                ->sort(SORT_STRING)
                ->values()
                ->all();

            if ($elementIds === []) {
                throw ValidationException::withMessages(['votes' => __('There are no sticky notes to vote on.')]);
            }

            $locked->voteSessions()->whereNotNull('closed_at')->whereNull('dismissed_at')->update(['dismissed_at' => now()]);

            $session = $locked->voteSessions()->create([
                'votes_per_member' => $votesPerMember,
                'frame_element_id' => $frameElementId,
                'allow_multiple' => $allowMultiple,
                'element_ids' => $elementIds,
                'opened_by_member_id' => $member->id,
            ]);

            (new WhiteboardChanged($locked->id))->sendToOthers();

            return $session;
        });
    }

    private function isLiveFrame(Whiteboard $board, string $frameElementId): bool
    {
        return $board->elements()
            ->where('element_id', $frameElementId)
            ->where('type', 'frame')
            ->where('is_deleted', false)
            ->exists();
    }
}
