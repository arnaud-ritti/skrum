<?php

namespace App\Http\Controllers\Concerns;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Retro;

trait LocksDiscussingRetro
{
    private function guardDiscussing(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);
    }

    private function lockDiscussingRetro(Retro $retro): Retro
    {
        $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

        $this->guardDiscussing($locked);

        return $locked;
    }

    private function lockActionItem(Retro $retro, ActionItem $actionItem): ActionItem
    {
        $locked = $this->lockDiscussingRetro($retro);
        $item = $locked->actionItems()->whereKey($actionItem->id)->lockForUpdate()->firstOrFail();

        $item->setRelation('retro', $locked);

        return $item;
    }
}
