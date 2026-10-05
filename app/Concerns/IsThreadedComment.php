<?php

namespace App\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * A comment of a card or a survey: one level of replies under an opening comment.
 *
 * @property string $id
 * @property string $participant_id
 * @property string|null $parent_comment_id
 * @property Carbon|null $deleted_at
 */
trait IsThreadedComment
{
    public function isDeleted(): bool
    {
        return $this->deleted_at !== null;
    }

    public function threadId(): string
    {
        return $this->parent_comment_id ?? $this->id;
    }

    /**
     * @return Collection<int, string> the authors of the thread this reply joins, none for an opening comment
     */
    public function threadParticipantIds(): Collection
    {
        if ($this->parent_comment_id === null) {
            return collect();
        }

        return static::query()
            ->where(fn (Builder $query) => $query->whereKey($this->parent_comment_id)->orWhere('parent_comment_id', $this->parent_comment_id))
            ->pluck('participant_id');
    }

    /**
     * A parent with replies is soft-deleted so the thread survives; a reply
     * whose soft-deleted parent has no reply left takes the parent with it.
     *
     * @return list<array{0: static, 1: bool}> each comment removed, in order, and whether it stays as a placeholder
     */
    public function deleteThreaded(): array
    {
        if ($this->parent_comment_id === null && $this->replies()->exists()) {
            $this->update(['content' => null, 'deleted_at' => now()]);

            return [[$this, true]];
        }

        $this->delete();

        $parent = $this->parent_comment_id === null ? null : static::query()->whereKey($this->parent_comment_id)->first();

        if ($parent === null || ! $parent->isDeleted() || $parent->replies()->exists()) {
            return [[$this, false]];
        }

        $parent->delete();

        return [[$this, false], [$parent, false]];
    }
}
