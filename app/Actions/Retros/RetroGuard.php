<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SurveyComment;
use App\Support\Gifs\GifCatalog;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RetroGuard
{
    public static function phase(Retro $retro, RetroPhase ...$allowed): void
    {
        if (in_array($retro->phase, $allowed, true)) {
            return;
        }

        throw new AuthorizationException(__('This action is not available in the current phase.'));
    }

    public static function takesActionItems(Retro $retro): void
    {
        if ($retro->phase->takesActionItems()) {
            return;
        }

        throw new AuthorizationException(__('This action is not available in the current phase.'));
    }

    public static function takesRotiVotes(Retro $retro): void
    {
        if ($retro->takesRotiVotes()) {
            return;
        }

        throw new AuthorizationException(__('This action is not available in the current phase.'));
    }

    public static function open(Retro $retro): void
    {
        if ($retro->phase->isOpen()) {
            return;
        }

        throw new AuthorizationException(__('This action is not available in the current phase.'));
    }

    public static function groupNaming(Retro $retro): void
    {
        self::phase($retro, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Actions);
        self::unlocked($retro);
    }

    public static function unlocked(Retro $retro): void
    {
        if (! $retro->is_locked) {
            return;
        }

        throw new HttpException(423, __('The board is closed for editing.'));
    }

    public static function reactionsEnabled(Retro $retro): void
    {
        if ($retro->reactions_enabled) {
            return;
        }

        throw new AuthorizationException(__('Reactions are turned off for this board.'));
    }

    public static function gifsEnabled(Retro $retro, GifCatalog $gifCatalog): void
    {
        if ($retro->gifs_enabled && $gifCatalog->isAvailable()) {
            return;
        }

        throw new AuthorizationException(__('GIFs are turned off for this board.'));
    }

    public static function facilitator(Retro $retro, Participant $participant): void
    {
        if ($retro->isFacilitator($participant)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator can do this.'));
    }

    public static function author(Card $card, Participant $participant): void
    {
        if ($card->participant_id === $participant->id) {
            return;
        }

        throw new AuthorizationException(__('You can only change your own cards.'));
    }

    public static function commentAuthor(CardComment|SurveyComment $comment, Participant $participant): void
    {
        if ($comment->participant_id === $participant->id) {
            return;
        }

        throw new AuthorizationException(__('You can only change your own comments.'));
    }
}
