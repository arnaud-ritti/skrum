<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Events\Retros\CardUpdated;
use App\Events\Retros\OwnCardSaved;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Gifs\GifCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateCard
{
    public function __construct(
        private PresentCard $presentCard,
        private GifCatalog $gifCatalog,
        private EnsureCardGif $ensureCardGif,
    ) {}

    /**
     * @param  array{content?: ?string, gif_id?: ?string}  $changes
     */
    public function handle(Retro $retro, Card $card, Participant $actor, array $changes): Card
    {
        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::author($card, $actor);

        if (($changes['gif_id'] ?? null) !== null && $changes['gif_id'] !== $card->gif_id) {
            $this->ensureCardGif->handle($retro, $changes['gif_id']);
        }

        return DB::transaction(function () use ($retro, $card, $actor, $changes): Card {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping);
            RetroGuard::unlocked($locked);

            $fresh = $locked->cards()->whereKey($card->id)->firstOrFail();

            RetroGuard::author($fresh, $actor);

            $content = array_key_exists('content', $changes) ? $changes['content'] : $fresh->content;
            $gifId = array_key_exists('gif_id', $changes) ? $changes['gif_id'] : $fresh->gif_id;

            if ($gifId !== null && $gifId !== $fresh->gif_id) {
                RetroGuard::gifsEnabled($locked, $this->gifCatalog);
            }

            if ($content === null && $gifId === null) {
                throw ValidationException::withMessages(['content' => __('A card needs text or a GIF.')]);
            }

            $fresh->update(['content' => $content, 'gif_id' => $gifId]);

            new CardUpdated($locked->id, $this->presentCard->handle($fresh, $locked, null))->sendToOthers();
            new OwnCardSaved($locked->id, $actor->id, $this->presentCard->handle($fresh, $locked, $actor))->sendToOthers();

            return $fresh->setRelation('retro', $locked);
        });
    }
}
