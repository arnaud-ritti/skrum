<?php

namespace App\Actions\Whiteboards;

use App\Events\Whiteboards\WhiteboardVoteChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVoteSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-import-type Tally from PresentWhiteboardVoting
 */
class CastWhiteboardVote
{
    public function __construct(private PresentWhiteboardVoting $presentWhiteboardVoting) {}

    /**
     * The board lock serialises every vote of a board, so the budget cannot
     * be overspent by two requests at once; a vote that changes nothing (a
     * retry) is answered without a write or a broadcast.
     *
     * @return Tally
     */
    public function handle(Whiteboard $board, WhiteboardVoteSession $session, WhiteboardMember $member, string $elementId, int $count): array
    {
        return DB::transaction(function () use ($board, $session, $member, $elementId, $count): array {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();
            $open = $locked->voteSessions()->whereKey($session->id)->firstOrFail();

            WhiteboardGuard::openVoteSession($open);

            if ($count > 1 && ! $open->allow_multiple) {
                throw ValidationException::withMessages(['count' => __('Only one vote per note is allowed.')]);
            }

            $element = $locked->elements()->where('element_id', $elementId)->first();

            if (! $open->isTarget($element)) {
                throw ValidationException::withMessages(['votes' => __('This note is not part of the vote.')]);
            }

            $elsewhere = (int) $open->votes()
                ->where('whiteboard_member_id', $member->id)
                ->where('element_id', '!=', $elementId)
                ->sum('count');

            if ($elsewhere + $count > $open->votes_per_member) {
                throw ValidationException::withMessages(['votes' => __('You have no votes left.')]);
            }

            $current = $open->votes()
                ->where('whiteboard_member_id', $member->id)
                ->where('element_id', $elementId)
                ->first();

            if (($current->count ?? 0) === $count) {
                return $this->presentWhiteboardVoting->tally($open, $member);
            }

            if ($count === 0) {
                $current?->delete();
            }

            if ($count > 0) {
                $open->votes()->updateOrCreate(
                    ['whiteboard_member_id' => $member->id, 'element_id' => $elementId],
                    ['count' => $count],
                );
            }

            (new WhiteboardVoteChanged($locked->id, $open->id, $this->presentWhiteboardVoting->finishedCount($open)))->sendToOthers();

            return $this->presentWhiteboardVoting->tally($open, $member);
        });
    }
}
