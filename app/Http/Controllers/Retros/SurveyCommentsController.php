<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentComment;
use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\SurveyGuard;
use App\Events\Retros\CommentNotification;
use App\Events\Retros\OwnSurveyCommentSaved;
use App\Events\Retros\SurveyDiscussionChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyComment;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SurveyCommentsController extends Controller
{
    public function __construct(private PresentComment $presentComment) {}

    public function store(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro, $survey, $participant);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:500'],
            'parentCommentId' => ['nullable', 'uuid'],
        ]);

        [$comment, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            $this->guard($locked, $fresh, $participant);

            $comment = $fresh->comments()->create([
                'retro_id' => $locked->id,
                'participant_id' => $participant->id,
                'parent_comment_id' => $this->threadIdFor($fresh, $validated['parentCommentId'] ?? null),
                'content' => $validated['content'],
            ]);

            $comment->load('participant.user');

            $this->broadcastSaved($locked, $fresh, $comment, $participant);
            $this->notify($locked, $fresh, $comment, $participant);

            return [$comment, $locked];
        });

        return response()->json(['comment' => $this->presentComment->handle($comment, $presentingRetro, $participant)], 201);
    }

    public function update(Request $request, Retro $retro, SurveyComment $surveyComment): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro, $surveyComment->survey, $participant);
        abort_if($surveyComment->isDeleted(), 404);
        RetroGuard::commentAuthor($surveyComment, $participant);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:500'],
        ]);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $surveyComment, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->surveyComments()->whereKey($surveyComment->id)->firstOrFail();

            $this->guard($locked, $fresh->survey, $participant);
            abort_if($fresh->isDeleted(), 404);
            RetroGuard::commentAuthor($fresh, $participant);

            $fresh->update(['content' => $validated['content']]);
            $fresh->load('participant.user');

            $this->broadcastSaved($locked, $fresh->survey, $fresh, $participant);

            return [$fresh, $locked];
        });

        return response()->json(['comment' => $this->presentComment->handle($fresh, $presentingRetro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, SurveyComment $surveyComment): Response
    {
        $participant = Participant::current($request);

        $this->guard($retro, $surveyComment->survey, $participant);
        $this->guardDeletion($retro, $surveyComment, $participant);

        DB::transaction(function () use ($retro, $surveyComment, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->surveyComments()->whereKey($surveyComment->id)->firstOrFail();
            $survey = $fresh->survey;

            $this->guard($locked, $survey, $participant);
            $this->guardDeletion($locked, $fresh, $participant);

            $this->deleteComment($locked, $fresh);

            (new SurveyDiscussionChanged($locked->id, $survey->id, $survey->commentCount()))->sendToOthers();
        });

        return response()->noContent();
    }

    private function guard(Retro $retro, Survey $survey, Participant $participant): void
    {
        SurveyGuard::activePhase($retro);
        RetroGuard::unlocked($retro);
        SurveyGuard::resultsVisible($survey, $participant);
    }

    private function guardDeletion(Retro $retro, SurveyComment $comment, Participant $participant): void
    {
        abort_if($comment->isDeleted(), 404);

        if ($retro->isFacilitator($participant)) {
            return;
        }

        RetroGuard::commentAuthor($comment, $participant);
    }

    /**
     * A parent with replies is soft-deleted so the thread survives; a reply
     * whose soft-deleted parent has no reply left takes the parent with it.
     */
    private function deleteComment(Retro $retro, SurveyComment $comment): void
    {
        if ($comment->parent_comment_id === null && $comment->replies()->exists()) {
            $comment->update(['content' => null, 'deleted_at' => now()]);

            return;
        }

        $comment->delete();

        $parent = $comment->parent_comment_id === null ? null : $retro->surveyComments()->whereKey($comment->parent_comment_id)->first();

        if ($parent === null || ! $parent->isDeleted() || $parent->replies()->exists()) {
            return;
        }

        $parent->delete();
    }

    private function threadIdFor(Survey $survey, ?string $parentCommentId): ?string
    {
        if ($parentCommentId === null) {
            return null;
        }

        $parent = $survey->comments()->whereKey($parentCommentId)->first();

        if ($parent === null) {
            throw ValidationException::withMessages(['parentCommentId' => __('The reply must belong to a comment on the same survey.')]);
        }

        return $parent->threadId();
    }

    private function broadcastSaved(Retro $retro, Survey $survey, SurveyComment $comment, Participant $author): void
    {
        (new SurveyDiscussionChanged($retro->id, $survey->id, $survey->commentCount()))->sendToOthers();
        (new OwnSurveyCommentSaved($retro->id, $author->id, $this->presentComment->handle($comment, $retro, $author)))->sendToOthers();
    }

    /**
     * Only recipients who can already see the survey's results are told,
     * so a notification never reveals the discussion early.
     */
    private function notify(Retro $retro, Survey $survey, SurveyComment $comment, Participant $commenter): void
    {
        $threadParticipantIds = $comment->parent_comment_id === null
            ? collect()
            : $survey->comments()
                ->where(fn (Builder $query) => $query->whereKey($comment->parent_comment_id)->orWhere('parent_comment_id', $comment->parent_comment_id))
                ->pluck('participant_id');

        $answeredIds = $survey->is_closed ? null : $survey->answeredParticipantIds();

        $recipients = $threadParticipantIds
            ->push($survey->created_by_participant_id)
            ->filter()
            ->unique()
            ->reject(fn (string $participantId): bool => $participantId === $commenter->id)
            ->filter(fn (string $participantId): bool => $answeredIds === null || $answeredIds->contains($participantId));

        $notification = [
            'surveyId' => $survey->id,
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
