<?php

namespace App\Actions\Retros;

use App\Models\Card;
use App\Models\CardComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Gifs\GifCatalog;

class PresentCard
{
    public function __construct(private GifCatalog $gifCatalog) {}

    /**
     * @return array{
     *     id: string,
     *     columnId: string,
     *     parentCardId: ?string,
     *     position: int,
     *     isMine: bool,
     *     hidden: bool,
     *     content: ?string,
     *     gif: ?array{id: string, previewUrl: string, url: string},
     *     author: ?array{id: string, name: string},
     *     groupName: ?string
     * }
     */
    public function handle(Card $card, Retro $retro, ?Participant $viewer): array
    {
        $isMine = $viewer !== null && $card->participant_id === $viewer->id;
        $isHidden = ! $isMine && $retro->phase->hidesOthersCards();
        $showsAuthor = ! $isHidden && ($isMine || ! $retro->is_anonymous);

        return [
            'id' => $card->id,
            'columnId' => $card->column_id,
            'parentCardId' => $card->parent_card_id,
            'position' => $card->position,
            'isMine' => $isMine,
            'hidden' => $isHidden,
            'content' => $isHidden ? null : $card->content,
            'gif' => $isHidden || $card->gif_id === null || ! $this->gifCatalog->isAvailable() ? null : [
                'id' => $card->gif_id,
                'previewUrl' => route('gifs.show', ['gif' => $card->gif_id, 'size' => 'preview'], false),
                'url' => route('gifs.show', ['gif' => $card->gif_id, 'size' => 'full'], false),
            ],
            'author' => $showsAuthor
                ? ['id' => $card->participant_id, 'name' => $card->participant->displayName()]
                : null,
            'groupName' => $isHidden ? null : $card->group_name,
        ];
    }

    public function commentCount(Card $card, bool $isHidden): int
    {
        if ($isHidden) {
            return 0;
        }

        return $card->comments->reject(fn (CardComment $comment) => $comment->isDeleted())->count();
    }

    /**
     * @return array{sentiment: ?string, category: ?string}
     */
    public function insights(Card $card, bool $isHidden, bool $llmConfigured): array
    {
        $isVisible = $llmConfigured && ! $isHidden;

        return [
            'sentiment' => $isVisible ? $card->sentiment?->value : null,
            'category' => $isVisible ? $card->category : null,
        ];
    }
}
