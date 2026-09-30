<?php

namespace App\Actions\Retros;

use App\Models\CardComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SurveyComment;
use Illuminate\Support\Collection;

class PresentComment
{
    /**
     * @return array{
     *     id: string,
     *     cardId?: string,
     *     surveyId?: string,
     *     parentCommentId: ?string,
     *     isMine: bool,
     *     deleted: bool,
     *     content: ?string,
     *     author: ?array{id: string, name: string},
     *     createdAt: string
     * }
     */
    public function handle(CardComment|SurveyComment $comment, Retro $retro, ?Participant $viewer): array
    {
        $isMine = $viewer !== null && $comment->participant_id === $viewer->id;
        $showsAuthor = ! $comment->isDeleted() && ($isMine || ! $retro->is_anonymous);
        $subject = $comment instanceof SurveyComment
            ? ['surveyId' => $comment->survey_id]
            : ['cardId' => $comment->card_id];

        return [
            'id' => $comment->id,
            ...$subject,
            'parentCommentId' => $comment->parent_comment_id,
            'isMine' => $isMine,
            'deleted' => $comment->isDeleted(),
            'content' => $comment->isDeleted() ? null : $comment->content,
            'author' => $showsAuthor
                ? ['id' => $comment->participant_id, 'name' => $comment->participant->displayName()]
                : null,
            'createdAt' => $comment->created_at->toIso8601String(),
        ];
    }

    /**
     * @template TComment of CardComment|SurveyComment
     *
     * @param  Collection<int, TComment>  $comments  every comment of one card or survey, oldest first
     * @return array<int, array<string, mixed>>
     */
    public function threads(Collection $comments, Retro $retro, ?Participant $viewer): array
    {
        $repliesByParent = $comments->whereNotNull('parent_comment_id')->groupBy('parent_comment_id');

        return $comments
            ->whereNull('parent_comment_id')
            ->map(fn (CardComment|SurveyComment $comment) => [
                ...$this->handle($comment, $retro, $viewer),
                'replies' => $repliesByParent->get($comment->id, collect())
                    ->map(fn (CardComment|SurveyComment $reply) => $this->handle($reply, $retro, $viewer))
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }
}
