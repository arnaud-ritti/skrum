<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentComment;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CommentCreated;
use App\Events\Retros\CommentDeleted;
use App\Events\Retros\CommentNotification;
use App\Events\Retros\CommentUpdated;
use App\Events\Retros\OwnCommentSaved;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CardCommentsController extends Controller
{
    public function __construct(private PresentComment $presentComment) {}

    public function store(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:500'],
            'parentCommentId' => ['nullable', 'uuid'],
        ]);

        [$comment, $presentingRetro] = DB::transaction(function () use ($retro, $card, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $fresh = $locked->cards()->whereKey($card->id)->firstOrFail();
            $parentId = $this->threadIdFor($fresh, $validated['parentCommentId'] ?? null);

            $comment = $fresh->comments()->create([
                'retro_id' => $locked->id,
                'participant_id' => $participant->id,
                'parent_comment_id' => $parentId,
                'content' => $validated['content'],
            ]);

            $comment->load('participant.user');

            (new CommentCreated($locked->id, $this->presentComment->handle($comment, $locked, null)))->sendToOthers();
            (new OwnCommentSaved($locked->id, $participant->id, $this->presentComment->handle($comment, $locked, $participant)))->sendToOthers();

            $this->notify($locked, $fresh, $comment, $participant);

            return [$comment, $locked];
        });

        return response()->json(['comment' => $this->presentComment->handle($comment, $presentingRetro, $participant)], 201);
    }

    public function update(Request $request, Retro $retro, CardComment $comment): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);
        abort_if($comment->isDeleted(), 404);
        RetroGuard::commentAuthor($comment, $participant);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:500'],
        ]);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $comment, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $fresh = $locked->comments()->whereKey($comment->id)->firstOrFail();

            abort_if($fresh->isDeleted(), 404);
            RetroGuard::commentAuthor($fresh, $participant);

            $fresh->update(['content' => $validated['content']]);
            $fresh->load('participant.user');

            (new CommentUpdated($locked->id, $this->presentComment->handle($fresh, $locked, null)))->sendToOthers();
            (new OwnCommentSaved($locked->id, $participant->id, $this->presentComment->handle($fresh, $locked, $participant)))->sendToOthers();

            return [$fresh, $locked];
        });

        return response()->json(['comment' => $this->presentComment->handle($fresh, $presentingRetro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, CardComment $comment): Response
    {
        $participant = Participant::current($request);

        $this->guard($retro);
        $this->guardDeletion($retro, $comment, $participant);

        DB::transaction(function () use ($retro, $comment, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $fresh = $locked->comments()->whereKey($comment->id)->firstOrFail();

            $this->guardDeletion($locked, $fresh, $participant);

            if ($fresh->parent_comment_id === null && $fresh->replies()->exists()) {
                $fresh->update(['content' => null, 'deleted_at' => now()]);

                (new CommentDeleted($locked->id, $fresh->card_id, $fresh->id, soft: true))->sendToOthers();

                return;
            }

            $fresh->delete();

            (new CommentDeleted($locked->id, $fresh->card_id, $fresh->id, soft: false))->sendToOthers();

            $parent = $fresh->parent_comment_id === null ? null : $locked->comments()->whereKey($fresh->parent_comment_id)->first();

            if ($parent === null || ! $parent->isDeleted() || $parent->replies()->exists()) {
                return;
            }

            $parent->delete();

            (new CommentDeleted($locked->id, $parent->card_id, $parent->id, soft: false))->sendToOthers();
        });

        return response()->noContent();
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);
    }

    private function guardDeletion(Retro $retro, CardComment $comment, Participant $participant): void
    {
        abort_if($comment->isDeleted(), 404);

        if ($retro->isFacilitator($participant)) {
            return;
        }

        RetroGuard::commentAuthor($comment, $participant);
    }

    private function threadIdFor(Card $card, ?string $parentCommentId): ?string
    {
        if ($parentCommentId === null) {
            return null;
        }

        $parent = $card->comments()->whereKey($parentCommentId)->first();

        if ($parent === null) {
            throw ValidationException::withMessages(['parentCommentId' => __('The reply must belong to a comment on the same card.')]);
        }

        return $parent->threadId();
    }

    private function notify(Retro $retro, Card $card, CardComment $comment, Participant $commenter): void
    {
        $threadParticipantIds = $comment->parent_comment_id === null
            ? collect()
            : $card->comments()
                ->where(fn (Builder $query) => $query->whereKey($comment->parent_comment_id)->orWhere('parent_comment_id', $comment->parent_comment_id))
                ->pluck('participant_id');

        $recipients = $threadParticipantIds
            ->push($card->participant_id)
            ->unique()
            ->reject(fn (string $participantId): bool => $participantId === $commenter->id);

        $notification = [
            'cardId' => $card->id,
            'commentId' => $comment->id,
            'threadId' => $comment->threadId(),
            'excerpt' => Str::limit((string) $comment->content, 79, '…'),
            ...($retro->is_anonymous ? [] : ['authorName' => $commenter->displayName()]),
        ];

        foreach ($recipients as $participantId) {
            (new CommentNotification($retro->id, $participantId, $notification))->sendToOthers();
        }
    }
}
