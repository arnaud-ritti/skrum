<?php

namespace App\Actions\Integrations;

use App\Models\ActionItem;
use Carbon\CarbonInterface;
use Illuminate\Support\Str;

class BuildIssueDraft
{
    private const TitleLength = 255;

    public function handle(ActionItem $item): IssueDraft
    {
        $item->loadMissing(['retro', 'team.workspace']);

        $lines = array_values(array_filter(
            array_map('trim', preg_split('/\R/u', $item->content) ?: []),
            fn (string $line): bool => $line !== '',
        ));

        $origin = $item->retro !== null
            ? __('From the retrospective ":title" on :date:', ['title' => $item->retro->title, 'date' => $this->date($item->retro->created_at)])
            : __('Added outside a retro on :date:', ['date' => $this->date($item->created_at)]);

        return new IssueDraft(
            Str::substr($lines[0] ?? $item->content, 0, self::TitleLength),
            $lines,
            $origin,
            route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]),
            $item->due_on?->toDateString(),
        );
    }

    private function date(?CarbonInterface $date): string
    {
        return $date === null ? '' : $date->locale(app()->getLocale())->isoFormat('LL');
    }
}
