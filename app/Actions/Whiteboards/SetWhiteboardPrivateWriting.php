<?php

namespace App\Actions\Whiteboards;

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardVersion;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class SetWhiteboardPrivateWriting
{
    public function __construct(private ScheduleWhiteboardVersion $scheduleWhiteboardVersion) {}

    /**
     * The caller holds the lock on the board row and broadcasts `board.changed`.
     */
    public function handle(Whiteboard $locked, bool $on): void
    {
        if ($on === $locked->private_writing) {
            return;
        }

        if (! $on) {
            $this->reveal($locked);

            return;
        }

        if ($locked->voteSessions()->whereNull('closed_at')->exists()) {
            throw ValidationException::withMessages(['private_writing' => __('Close the vote first.')]);
        }

        $locked->update(['private_writing' => true]);
    }

    /**
     * Live notes become ordinary elements under a new seq, so that every
     * client fetches them; nothing of them is broadcast. A note deleted
     * while it was hidden keeps its flag and is never shown: the row
     * remembers the reveal that held it back, for the versions older than
     * it, without a new `updated_at`, which is what the purge counts from.
     */
    private function reveal(Whiteboard $locked): void
    {
        $fromSeq = $locked->seq;
        $seq = $fromSeq + 1;

        $locked->elements()
            ->where('is_private', true)
            ->where('is_deleted', true)
            ->toBase()
            ->update(['withheld_at' => now()]);

        $hidden = $locked->elements()->where('is_private', true)->where('is_deleted', false);
        $revealedIds = $hidden->clone()->pluck('element_id');

        if ($revealedIds->isEmpty()) {
            $locked->update(['private_writing' => false]);

            return;
        }

        $hidden->update(['is_private' => false, 'seq' => $seq]);

        $this->revealInVersions($locked, array_values($revealedIds->all()));

        $locked->update(['private_writing' => false, 'seq' => $seq]);

        $this->scheduleWhiteboardVersion->handle($locked, $fromSeq);

        (new WhiteboardElementsChanged($locked->id, $seq, $fromSeq, null))->sendToOthers();
    }

    /**
     * A version stored while the notes were hidden may now show them; what
     * stays on its list was deleted before the reveal and is never shown.
     * The list holds ids, and an id is free again once its tombstone is
     * purged: only a row that is not younger than the version is the
     * element the version stored. A row that a reveal held back as a
     * tombstone stays out of every version stored before that reveal, even
     * when its author brought it back hidden since.
     *
     * @param  list<string>  $revealedIds
     */
    private function revealInVersions(Whiteboard $locked, array $revealedIds): void
    {
        $locked->versions()
            ->whereJsonLength('private_element_ids', '>', 0)
            ->get(['id', 'private_element_ids', 'created_at'])
            ->each(function (WhiteboardVersion $version) use ($locked, $revealedIds): void {
                $listed = array_values(array_intersect($version->private_element_ids, $revealedIds));

                if ($listed === []) {
                    return;
                }

                $shown = $locked->elements()
                    ->whereIn('element_id', $listed)
                    ->where('created_at', '<=', $version->created_at)
                    ->where(fn (Builder $rows) => $rows
                        ->whereNull('withheld_at')
                        ->orWhere('withheld_at', '<', $version->created_at))
                    ->pluck('element_id')
                    ->all();

                $version->update([
                    'private_element_ids' => array_values(array_diff($version->private_element_ids, $shown)),
                ]);
            });
    }
}
